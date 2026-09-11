import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { CustomColumn } from '../types';

interface CustomColumnModalProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onSave: (column: CustomColumn) => void;
}

export const CustomColumnModal: React.FC<CustomColumnModalProps> = ({
  isOpen,
  projectId,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomColumn['type']>('text');
  const [options, setOptions] = useState<string[]>(['Option 1', 'Option 2']);
  const [newOption, setNewOption] = useState('');
  const [defaultValue, setDefaultValue] = useState<any>('');

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const col: CustomColumn = {
      id: `col-${Date.now()}`,
      projectId,
      name: name.trim(),
      type,
      options: type === 'select' ? options : undefined,
      defaultValue: type === 'checkbox' ? false : defaultValue,
    };

    onSave(col);
    onClose();
  };

  return (
    <div
      id="custom-column-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
    >
      <div
        id="custom-column-modal-card"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Add Custom Column</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Column Name *
            </label>
            <input
              id="input-col-name"
              type="text"
              required
              placeholder="e.g. Budget ($), Deliverable, Vendor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Data Type
            </label>
            <select
              id="select-col-type"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden bg-white"
            >
              <option value="text">Text (General string)</option>
              <option value="number">Number</option>
              <option value="currency">Currency ($)</option>
              <option value="date">Date</option>
              <option value="checkbox">Checkbox (Yes / No)</option>
              <option value="select">Dropdown (Single Choice)</option>
            </select>
          </div>

          {type === 'select' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Dropdown Choices
              </label>
              <div className="space-y-2 mb-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm">
                    <span>{opt}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(i)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New choice option"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              id="btn-save-column"
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
            >
              Add Column
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
