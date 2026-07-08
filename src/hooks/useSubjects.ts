import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

export function useSubjects() {
  const [masterSubjects, setMasterSubjects] = useState<string[]>([]);
  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});

  useEffect(() => {
    getDocs(query(collection(db, 'subjects'), orderBy('name'))).then(snap => {
      const names: string[] = [];
      const smap: Record<string, string> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        names.push(data.name);
        smap[data.name] = data.shortName || data.name;
      });
      setMasterSubjects(names);
      setSubjectMap(smap);
    });
  }, []);

  const formatSubjects = (subjects: string[] | undefined) => {
    if (!subjects) return '';
    return subjects.map(s => subjectMap[s] || s).join(', ');
  };

  return { masterSubjects, subjectMap, formatSubjects };
}
