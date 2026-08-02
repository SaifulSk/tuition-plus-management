import re

with open('src/pages/teacher/Schedule.tsx', 'r') as f:
    content = f.read()

# Add SlotForm and DEFAULT_FORM
content = content.replace(
    """  const [form, setForm] = useState({
    day: 'Monday' as DayOfWeek,
    startTime: '16:00',
    endTime: '17:00',
    type: 'tuition' as 'tuition' | 'other_tuition',
    notes: '',
  });
  const [subjects, setSubjects] = useState<string[]>([]);""",
    """  type SlotForm = {
    day: DayOfWeek;
    startTime: string;
    endTime: string;
    type: 'tuition' | 'other_tuition';
    notes: string;
    subjects: string[];
  };
  const DEFAULT_FORM: SlotForm = { day: 'Monday', startTime: '16:00', endTime: '17:00', type: 'tuition', notes: '', subjects: [] };
  const [forms, setForms] = useState<SlotForm[]>([DEFAULT_FORM]);"""
)

# Fix openEditModal
content = content.replace(
    """    setForm({
      day: s.day || 'Monday',
      startTime: s.startTime || '16:00',
      endTime: s.endTime || '17:00',
      type: s.type || 'tuition',
      notes: s.notes || '',
    });
    setSubjects(s.subjects || []);""",
    """    setForms([{
      day: s.day || 'Monday',
      startTime: s.startTime || '16:00',
      endTime: s.endTime || '17:00',
      type: s.type || 'tuition',
      notes: s.notes || '',
      subjects: s.subjects || [],
    }]);"""
)

# Fix closeModal
content = content.replace(
    """    setForm({ day: 'Monday', startTime: '16:00', endTime: '17:00', type: 'tuition', notes: '' });
    setSubjects([]);""",
    """    setForms([DEFAULT_FORM]);"""
)

# Fix "Add Slot" button in header
content = content.replace(
    """            setForm({ day: 'Monday', startTime: '16:00', endTime: '17:00', type: 'tuition', notes: '' }); 
            setSubjects([]); """,
    """            setForms([DEFAULT_FORM]); """
)

# Fix "Add Slot" empty day master view
content = content.replace(
    """                      setForm({ day: day as DayOfWeek, startTime: '16:00', endTime: '17:00', type: 'tuition', notes: '' });
                      setSubjects([]);""",
    """                      setForms([{ ...DEFAULT_FORM, day: day as DayOfWeek }]);"""
)

# Fix "Add Student" inside master view slot card
content = content.replace(
    """                          setForm({ day: day as DayOfWeek, startTime: slotInfo.startTime, endTime: slotInfo.endTime, type: slotInfo.type, notes: '' });
                          setSubjects([]);""",
    """                          setForms([{ ...DEFAULT_FORM, day: day as DayOfWeek, startTime: slotInfo.startTime, endTime: slotInfo.endTime, type: slotInfo.type }]);"""
)

# Fix "Add Slot" button in student view
content = content.replace(
    """                        setForm({ day: day as DayOfWeek, startTime: '16:00', endTime: '17:00', type: 'tuition', notes: '' });
                        setSubjects([]);""",
    """                        setForms([{ ...DEFAULT_FORM, day: day as DayOfWeek }]);"""
)

# Fix handleSave
content = content.replace(
    """  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalStudentId) { toast.error('Select a student'); return; }
    setSaving(true);
    try {
      const payload = { ...form, subjects, studentId: modalStudentId };
      if (editingSlotId) {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'schedules', modalStudentId, 'slots', editingSlotId), payload);
        toast.success('Slot updated!');
      } else {
        await addDoc(collection(db,'schedules',modalStudentId,'slots'), payload);
        toast.success('Slot added!');
      }
      closeModal();
      loadAllSlots();
      if (selectedStudent === modalStudentId) loadSlots(modalStudentId);
    } catch(err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };""",
    """  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalStudentId) { toast.error('Select a student'); return; }
    setSaving(true);
    try {
      if (editingSlotId) {
        const payload = { ...forms[0], studentId: modalStudentId };
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'schedules', modalStudentId, 'slots', editingSlotId), payload);
        toast.success('Slot updated!');
      } else {
        await Promise.all(forms.map(async f => {
          const payload = { ...f, studentId: modalStudentId };
          const { addDoc, collection } = await import('firebase/firestore');
          await addDoc(collection(db,'schedules',modalStudentId,'slots'), payload);
        }));
        toast.success('Slots added!');
      }
      closeModal();
      loadAllSlots();
      if (selectedStudent === modalStudentId) loadSlots(modalStudentId);
    } catch(err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };"""
)

with open('src/pages/teacher/Schedule.tsx', 'w') as f:
    f.write(content)
