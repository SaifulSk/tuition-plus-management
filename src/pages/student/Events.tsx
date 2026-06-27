import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { CenterEvent, EventType } from '../../types';
import { PartyPopper, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';

const TYPE_EMOJI: Record<EventType, string> = {
  picnic:'🧺', farewell:'🎓', feast:'🍽️', study_trip:'🗺️', other:'🎉'
};

export default function StudentEvents() {
  const { appUser } = useAuth();
  const [events, setEvents] = useState<CenterEvent[]>([]);
  const [myStudentId, setMyStudentId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      const userDoc = await getDoc(doc(db, 'users', appUser!.uid));
      const sid = userDoc.data()?.studentId;
      setMyStudentId(sid || '');
      const snap = await getDocs(query(collection(db,'events'), orderBy('date','desc')));
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CenterEvent));
      setLoading(false);
    }
    load();
  }, [appUser]);

  const myEvents = events.filter(e => !myStudentId || e.attendees?.includes(myStudentId));
  const allEvents = events;

  if (loading) return <div className="page"><div className="loader large"/></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Events</h1>
          <p className="page-sub">Tuition Plus events and activities</p>
        </div>
      </div>

      {myEvents.length > 0 && (
        <>
          <h3 className="section-title mb-8">🌟 My Events</h3>
          <div className="events-grid mb-16">
            {myEvents.map(ev => (
              <div key={ev.id} className="event-card highlighted">
                <div className="event-card-header">
                  <div className="event-emoji">{TYPE_EMOJI[ev.type] || '🎉'}</div>
                  <div className="event-type-label">{ev.type.replace('_',' ')}</div>
                </div>
                <div className="event-card-body">
                  <h3 className="event-name">{ev.title}</h3>
                  <div className="event-meta">
                    <span><Calendar size={14}/> {ev.date ? format(ev.date.toDate(),'dd MMM yyyy') : '—'}</span>
                    <span><Users size={14}/> {ev.attendees?.length || 0} students</span>
                  </div>
                  {ev.description && <p className="event-desc">{ev.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="section-title mb-8">📅 All Center Events</h3>
      {allEvents.length === 0 ? (
        <div className="empty-state"><PartyPopper size={48}/><p>No events yet</p></div>
      ) : (
        <div className="events-grid">
          {allEvents.map(ev => (
            <div key={ev.id} className={`event-card ${ev.attendees?.includes(myStudentId) ? 'highlighted' : ''}`}>
              <div className="event-card-header">
                <div className="event-emoji">{TYPE_EMOJI[ev.type] || '🎉'}</div>
                <div className="event-type-label">{ev.type.replace('_',' ')}</div>
                {ev.attendees?.includes(myStudentId) && <span className="badge badge-green ml-auto">Attending</span>}
              </div>
              <div className="event-card-body">
                <h3 className="event-name">{ev.title}</h3>
                <div className="event-meta">
                  <span><Calendar size={14}/> {ev.date ? format(ev.date.toDate(),'dd MMM yyyy') : '—'}</span>
                </div>
                {ev.description && <p className="event-desc">{ev.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
