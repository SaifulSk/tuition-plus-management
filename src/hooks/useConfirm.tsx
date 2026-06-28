import { useState } from 'react';

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);

  const confirm = (msg: string, onConfirm: () => void) => {
    setMessage(msg);
    setOnConfirmAction(() => onConfirm);
    setIsOpen(true);
  };

  const ConfirmDialog = isOpen ? (
    <div className="modal-overlay" onClick={() => setIsOpen(false)} style={{ zIndex: 9999 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2>Please Confirm</h2>
        </div>
        <div className="modal-body" style={{ fontSize: '16px' }}>
          <p>{message}</p>
          <div className="modal-footer">
            <button className="btn-ghost" onClick={() => setIsOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => {
              if (onConfirmAction) onConfirmAction();
              setIsOpen(false);
            }}>Confirm</button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
