import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

export function useExamNames() {
  const [examNames, setExamNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, 'examNames'), orderBy('name')))
      .then(snap => {
        const names = snap.docs.map(d => d.data().name as string).filter(Boolean);
        names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        setExamNames(names);
        setLoading(false);
      })
      .catch(() => {
        getDocs(collection(db, 'examNames')).then(snap => {
          const names = snap.docs.map(d => d.data().name as string).filter(Boolean);
          names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
          setExamNames(names);
          setLoading(false);
        });
      });
  }, []);

  return { examNames, loading };
}
