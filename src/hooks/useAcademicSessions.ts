import { useState, useEffect } from 'react';
import { collection, getDocs, collectionGroup } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getCurrentSession, getNextSession, getSessionFromDate, getSessionFromMonthStr } from '../utils/dateUtils';
import type { Student } from '../types';

let cachedSessions: string[] | null = null;
let listeners: Array<(sessions: string[]) => void> = [];

export function updateCachedSessions(newSessions: string[]) {
  cachedSessions = newSessions;
  listeners.forEach(cb => cb(newSessions));
}

export function useAcademicSessions(passedStudents?: Student[]) {
  const currentSess = getCurrentSession();
  const nextSess = getNextSession(currentSess);

  const [sessions, setSessions] = useState<string[]>(() => {
    if (cachedSessions) return cachedSessions;
    return [nextSess, currentSess];
  });

  useEffect(() => {
    listeners.push(setSessions);
    return () => {
      listeners = listeners.filter(cb => cb !== setSessions);
    };
  }, []);

  useEffect(() => {
    if (passedStudents && passedStudents.length > 0) {
      const set = new Set<string>(cachedSessions || [nextSess, currentSess]);
      passedStudents.forEach(s => {
        if (s.session && /^\d{4}-\d{4}$/.test(s.session)) set.add(s.session);
        if (s.joiningDate) set.add(getSessionFromDate(s.joiningDate));
        if (s.leavingMonth) set.add(getSessionFromMonthStr(s.leavingMonth));
      });
      const sorted = Array.from(set).sort().reverse();
      updateCachedSessions(sorted);
    }
  }, [passedStudents, nextSess, currentSess]);

  useEffect(() => {
    if (cachedSessions) return;

    const loadAllActivities = async () => {
      try {
        const sessionSet = new Set<string>([nextSess, currentSess]);

        // 1. Students collection
        try {
          const studSnap = await getDocs(collection(db, 'students'));
          studSnap.docs.forEach(d => {
            const data = d.data();
            if (data.session && /^\d{4}-\d{4}$/.test(data.session)) sessionSet.add(data.session);
            if (data.joiningDate) sessionSet.add(getSessionFromDate(data.joiningDate));
            if (data.leavingMonth) sessionSet.add(getSessionFromMonthStr(data.leavingMonth));
          });
        } catch (e) {
          console.warn('Error reading students for sessions:', e);
        }

        // 2. ExamNames Master
        try {
          const examSnap = await getDocs(collection(db, 'examNames'));
          examSnap.docs.forEach(d => {
            const dates = d.data().sessionDates;
            if (dates && typeof dates === 'object') {
              Object.keys(dates).forEach(s => {
                if (/^\d{4}-\d{4}$/.test(s)) sessionSet.add(s);
              });
            }
          });
        } catch (e) {
          // ignore
        }

        // 3. Payments
        try {
          const paySnap = await getDocs(collectionGroup(db, 'payments'));
          paySnap.docs.forEach(d => {
            const data = d.data();
            if (Array.isArray(data.monthsPaid)) {
              data.monthsPaid.forEach((m: string) => sessionSet.add(getSessionFromMonthStr(m)));
            }
            if (data.datePaid) sessionSet.add(getSessionFromDate(data.datePaid));
          });
        } catch (e) {
          // ignore
        }

        // 4. Tests
        try {
          const testSnap = await getDocs(collection(db, 'tests'));
          testSnap.docs.forEach(d => {
            const data = d.data();
            if (data.date) sessionSet.add(getSessionFromDate(data.date));
          });
        } catch (e) {
          // ignore
        }

        const validSessions = Array.from(sessionSet)
          .filter(s => /^\d{4}-\d{4}$/.test(s))
          .sort()
          .reverse();

        updateCachedSessions(validSessions);
      } catch (err) {
        console.error('Error loading academic sessions:', err);
      }
    };

    loadAllActivities();
  }, [nextSess, currentSess]);

  return {
    sessions,
    sessionYears: sessions.map(s => parseInt(s.split('-')[0], 10))
  };
}
