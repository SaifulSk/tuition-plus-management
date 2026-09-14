import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ExamNameMaster } from '../types';

export function useExamNames() {
  const [examMasters, setExamMasters] = useState<ExamNameMaster[]>([]);
  const [examNames, setExamNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, 'examNames'), orderBy('name')))
      .then(snap => {
        const masters = snap.docs.map(d => ({ id: d.id, ...d.data() }) as ExamNameMaster);
        masters.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        setExamMasters(masters);
        setExamNames(masters.map(m => m.name).filter(Boolean));
        setLoading(false);
      })
      .catch(() => {
        getDocs(collection(db, 'examNames')).then(snap => {
          const masters = snap.docs.map(d => ({ id: d.id, ...d.data() }) as ExamNameMaster);
          masters.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
          setExamMasters(masters);
          setExamNames(masters.map(m => m.name).filter(Boolean));
          setLoading(false);
        });
      });
  }, []);

  const getExamDate = (name: string, session: string): string | undefined => {
    const match = examMasters.find(m => m.name.toLowerCase() === name.toLowerCase());
    return match?.sessionDates?.[session];
  };

  return { examNames, examMasters, loading, getExamDate };
}
