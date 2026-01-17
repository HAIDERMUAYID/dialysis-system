import React, { useState } from 'react';
import '../../App.css';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, placeholder = 'ابحث...' }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2" style={{ marginBottom: '1rem' }}>
      <input
        type="text"
        className="form-control"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1 }}
      />
      <button type="submit" className="btn btn-primary">بحث</button>
      {query && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setQuery('');
            onSearch('');
          }}
        >
          إعادة تعيين
        </button>
      )}
    </form>
  );
};

export default SearchBar;
