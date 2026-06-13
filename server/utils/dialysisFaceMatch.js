/** مطابقة embeddings الوجه — cosine similarity (128-d face-api descriptor) */

const EMBEDDING_DIM = 128;
const MIN_EMBEDDING_DIM = 64;
const MAX_EMBEDDING_DIM = 512;

/** عتبات صارمة — يجب أن تتطابق مع client/src/components/Dialysis/face/dialysisFaceConfig.ts */
const DEFAULT_AUTO_THRESHOLD = 0.88;
const DEFAULT_STRONG_THRESHOLD = 0.91;
const DEFAULT_MIN_MARGIN = 0.06;
const DEFAULT_STRONG_MIN_MARGIN = 0.025;
const DEFAULT_VERIFY_MIN_SCORE = 0.86;
const DEFAULT_SUGGEST_MIN = 0.62;
const ENROLL_MIN_SAMPLES = 3;
const ENROLL_MIN_PAIRWISE = 0.72;

function parseEmbedding(raw) {
  if (raw == null) return null;
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr) || arr.length < MIN_EMBEDDING_DIM || arr.length > MAX_EMBEDDING_DIM) {
    return null;
  }
  const out = [];
  for (const x of arr) {
    const n = Number(x);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}

function normalizeEmbedding(raw) {
  const arr = parseEmbedding(raw);
  if (!arr) return null;
  let normSq = 0;
  for (const v of arr) normSq += v * v;
  const denom = Math.sqrt(normSq);
  if (!denom) return null;
  return arr.map((v) => v / denom);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return -1;
  return dot / denom;
}

/** متوسط عدة descriptors (تسجيل متعدد الإطارات) — يُطبَّع الناتج */
function averageEmbeddings(list) {
  const parsed = list.map((x) => parseEmbedding(x)).filter(Boolean);
  if (!parsed.length) return null;
  const dim = parsed[0].length;
  if (!parsed.every((p) => p.length === dim)) return null;
  const sum = new Array(dim).fill(0);
  for (const p of parsed) {
    for (let i = 0; i < dim; i += 1) sum[i] += p[i];
  }
  return normalizeEmbedding(sum.map((v) => v / parsed.length));
}

function minPairwiseSimilarity(normalizedList) {
  if (normalizedList.length < 2) return 1;
  let minSim = 1;
  for (let i = 0; i < normalizedList.length; i += 1) {
    for (let j = i + 1; j < normalizedList.length; j += 1) {
      minSim = Math.min(minSim, cosineSimilarity(normalizedList[i], normalizedList[j]));
    }
  }
  return minSim;
}

/**
 * التحقق من جودة عينات التسجيل — يمنع حفظ بصمة غير متسقة
 * @param {unknown[]} list
 */
function validateEnrollmentSamples(list) {
  if (!Array.isArray(list) || list.length < ENROLL_MIN_SAMPLES) {
    return {
      ok: false,
      error: `يُطلَب ${ENROLL_MIN_SAMPLES} لقطات وجه واضحة على الأقل`,
    };
  }

  const normalized = list.map((x) => normalizeEmbedding(x)).filter(Boolean);
  if (normalized.length < ENROLL_MIN_SAMPLES) {
    return { ok: false, error: 'بصمة الوجه غير صالحة أو ناقصة' };
  }

  const pairwise = minPairwiseSimilarity(normalized);
  if (pairwise < ENROLL_MIN_PAIRWISE) {
    return {
      ok: false,
      error:
        'اللقطات غير متسقة — ثبّت رأسك، حسّن الإضاءة، وأعد التقاط الوجه من نفس الزاوية',
      pairwise,
    };
  }

  const embedding = averageEmbeddings(list);
  if (!embedding) {
    return { ok: false, error: 'تعذر حساب بصمة الوجه' };
  }

  return { ok: true, embedding, sample_count: normalized.length, pairwise };
}

/**
 * @param {number[]} probe — normalized
 * @param {{ id: number, fullName: string, embedding: number[] }[]} gallery
 * @param {{ topK?: number, minScore?: number }} opts
 */
function rankFaceMatches(probe, gallery, opts = {}) {
  const topK = opts.topK ?? 5;
  const minScore = opts.minScore ?? DEFAULT_SUGGEST_MIN;
  const p = normalizeEmbedding(probe);
  if (!p) return [];

  const scored = gallery
    .map((row) => {
      const emb = normalizeEmbedding(row.embedding);
      if (!emb) return null;
      const score = cosineSimilarity(p, emb);
      return { patient_id: row.id, full_name: row.fullName, confidence: score };
    })
    .filter(Boolean)
    .filter((r) => r.confidence >= minScore)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, topK);

  return scored.map((r) => ({
    ...r,
    confidence: Math.round(r.confidence * 1000) / 1000,
  }));
}

/**
 * قرار تلقائي — اتفاق الإطارات أولاً، ثم عتبات متدرجة (تدعم أشقاء/متشابهين)
 */
function evaluateStrictAutoMatch(avgMatches, perProbeMatches, opts = {}) {
  const autoThreshold = opts.autoThreshold ?? DEFAULT_AUTO_THRESHOLD;
  const strongThreshold = opts.strongThreshold ?? DEFAULT_STRONG_THRESHOLD;
  const minMargin = opts.minMargin ?? DEFAULT_MIN_MARGIN;
  const strongMinMargin = opts.strongMinMargin ?? DEFAULT_STRONG_MIN_MARGIN;
  const verifyMinScore = opts.verifyMinScore ?? DEFAULT_VERIFY_MIN_SCORE;

  if (!avgMatches?.length) {
    return { ok: false, reason: 'NO_MATCH', message: 'لم تُطابق أي بصمة مسجّلة' };
  }

  const top = avgMatches[0];
  const second = avgMatches[1];
  const margin = second ? top.confidence - second.confidence : 1;

  if (Array.isArray(perProbeMatches) && perProbeMatches.length > 0) {
    for (let i = 0; i < perProbeMatches.length; i += 1) {
      const probeTop = perProbeMatches[i]?.[0];
      if (!probeTop || probeTop.patient_id !== top.patient_id) {
        return {
          ok: false,
          reason: 'FRAME_DISAGREE',
          message: 'الإطارات غير متطابقة — ثبّت وجهك وأعد المحاولة',
          top,
          frame_index: i,
        };
      }
      if (probeTop.confidence < verifyMinScore) {
        return {
          ok: false,
          reason: 'FRAME_LOW_SCORE',
          message: `إطار ${i + 1}: ثقة منخفضة — حسّن الإضاءة`,
          top,
          frame_index: i,
        };
      }
    }
  }

  if (top.confidence < autoThreshold) {
    return {
      ok: false,
      reason: 'LOW_CONFIDENCE',
      message: `الثقة ${Math.round(top.confidence * 100)}% — أقل من المطلوب للقبول التلقائي`,
      top,
    };
  }

  const marginOkStandard = !second || margin >= minMargin;
  const marginOkStrong = !second || margin >= strongMinMargin;

  if (top.confidence >= strongThreshold && marginOkStrong) {
    return {
      ok: true,
      reason: 'STRONG_MATCH',
      patient_id: top.patient_id,
      full_name: top.full_name,
      confidence: top.confidence,
      margin: second ? Math.round(margin * 1000) / 1000 : null,
    };
  }

  if (marginOkStandard) {
    return {
      ok: true,
      reason: 'VERIFIED',
      patient_id: top.patient_id,
      full_name: top.full_name,
      confidence: top.confidence,
      margin: second ? Math.round(margin * 1000) / 1000 : null,
    };
  }

  return {
    ok: false,
    reason: 'AMBIGUOUS',
    message: `الأقرب ${Math.round(top.confidence * 100)}% والثاني ${Math.round((second?.confidence ?? 0) * 100)}% — اختر يدوياً`,
    top,
    second,
    margin: Math.round(margin * 1000) / 1000,
  };
}

/**
 * مطابقة صارمة متعددة الإطارات — إطار واحد يُعامل كتحقق مفرد
 * @param {unknown[]} probes
 * @param {{ id: number, fullName: string, embedding: unknown }[]} gallery
 */
function identifyFaceStrict(probes, gallery, opts = {}) {
  const normalized = (Array.isArray(probes) ? probes : [probes])
    .map((p) => normalizeEmbedding(p))
    .filter(Boolean);

  if (!normalized.length) {
    return { error: 'بصمة الوجه للمطابقة غير صالحة', matches: [], auto_match: { ok: false } };
  }

  const topK = opts.topK ?? 5;
  const minScore = opts.minScore ?? DEFAULT_SUGGEST_MIN;

  const perProbeMatches = normalized.map((p) =>
    rankFaceMatches(p, gallery, { topK: 3, minScore })
  );

  const avgProbe = averageEmbeddings(normalized);
  const matches = rankFaceMatches(avgProbe, gallery, { topK, minScore });

  const auto_match = evaluateStrictAutoMatch(matches, perProbeMatches, opts);

  return {
    matches,
    per_probe_top: perProbeMatches.map((m) => m[0] ?? null),
    auto_match,
    probe_count: normalized.length,
  };
}

function stripFaceEmbeddingFromPatient(patient) {
  if (!patient || typeof patient !== 'object') return patient;
  const { faceEmbeddingJson, faceEnrollMetaJson, ...rest } = patient;
  const meta =
    faceEnrollMetaJson && typeof faceEnrollMetaJson === 'object' ? faceEnrollMetaJson : null;
  return {
    ...rest,
    hasFaceEnrolled: Boolean(patient.faceEnrolledAt),
    faceEnrollQuality:
      meta && typeof meta.enroll_quality === 'number' ? meta.enroll_quality : null,
    facePipelineVersion:
      meta && typeof meta.pipeline_version === 'string' ? meta.pipeline_version : null,
    faceCameraFacing:
      meta && typeof meta.camera_facing === 'string' ? meta.camera_facing : null,
  };
}

module.exports = {
  EMBEDDING_DIM,
  DEFAULT_AUTO_THRESHOLD,
  DEFAULT_MIN_MARGIN,
  DEFAULT_VERIFY_MIN_SCORE,
  ENROLL_MIN_SAMPLES,
  ENROLL_MIN_PAIRWISE,
  parseEmbedding,
  normalizeEmbedding,
  cosineSimilarity,
  averageEmbeddings,
  minPairwiseSimilarity,
  validateEnrollmentSamples,
  rankFaceMatches,
  evaluateStrictAutoMatch,
  identifyFaceStrict,
  stripFaceEmbeddingFromPatient,
};
