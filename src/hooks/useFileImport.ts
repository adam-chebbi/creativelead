import { useCallback, useState } from 'react';
import { parseJson } from '@/utils/parser';
import { ImportResult } from '@/types';

export function useFileImport() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setImportSuccess(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      let parsed: ImportResult;

      if (file.name.toLowerCase().endsWith('.json')) {
        parsed = parseJson(text, file.name);
      } else {
        parsed = { leads: [], errors: ['Unsupported file type. Please upload a .json file.'], source: 'json', fileName: file.name };
      }
      setResult(parsed);
    };
    reader.readAsText(file, 'utf-8');
  }, []);

  const handleImport = async () => {
    if (!result || result.leads.length === 0) return;
    setImporting(true);
    try {
      const response = await fetch('/api/leads/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.leads),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Server error: ${response.status}`);
      }

      setImportSuccess(true);
    } catch (e) {
      console.error('Failed to import leads to server', e);
      alert(`Failed to import leads: ${e instanceof Error ? e.message : 'Unknown error. Check console.'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleReset = useCallback(() => {
    setResult(null);
    setImportSuccess(false);
  }, []);

  return {
    result,
    importing,
    importSuccess,
    onDrop,
    handleImport,
    handleReset
  };
}
