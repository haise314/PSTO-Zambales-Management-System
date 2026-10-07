export const TABS = [
  ['calendar', 'Calendar'], ['attendance', 'Attendance'], ['leave', 'Leave'], ['trainings', 'Training Attended'],
  ['email', 'Email Tracker'], ['memos', 'Memo'], ['documentation', 'Documentations'], ['contacts', 'Contacts'],
  ['focal', 'Focal Person'], ['personnel', 'PSTO Personnel'], ['funds', 'Office Fund'], ['audit', 'Audit Log'],
].map(([key, label]) => ({ key, label }))

export const NAV = [
  { key: 'dashboard', label: '🏠 DASHBOARD', always: true },
  { key: 'overview', label: '📊 OVERVIEW', always: true },
  { key: 'calendar', label: '📅 CALENDAR' }, { key: 'attendance', label: '👥 ATTENDANCE' },
  { key: 'leave', label: '🏖️ LEAVE' }, { key: 'trainings', label: '🎓 TRAINING ATTENDED' },
  { key: 'email', label: '✉️ EMAIL TRACKER' }, { key: 'memos', label: '📄 MEMO' },
  { key: 'documentation', label: '🗂️ DOCUMENTATIONS' }, { key: 'contacts', label: '📞 CONTACTS' },
  { key: 'focal', label: '🎯 FOCAL PERSON' }, { key: 'personnel', label: '👤 PSTO PERSONNEL' },
  { key: 'funds', label: '💰 OFFICE FUND' },
  { key: 'audit', label: '🕵️ AUDIT LOG', adminOnly: true },
  { key: 'users', label: '🔐 USER MANAGEMENT', adminOnly: true },
  { key: 'backup', label: '💾 BACKUP / RESTORE', adminOnly: true },
]

export function defaultPerms(role) {
  const p = {}
  TABS.forEach((t) => {
    if (t.key === 'funds') p[t.key] = { view: role !== 'Guest', add: false, edit: false, delete: false }
    else if (role === 'Guest')
      p[t.key] = { view: ['calendar', 'contacts', 'personnel'].includes(t.key), add: false, edit: false, delete: false }
    else p[t.key] = { view: true, add: true, edit: true, delete: true }
  })
  return p
}

export const LEAVE_TYPES = ['Vacation Leave', 'Mandatory/Forced Leave', 'Sick Leave', 'Maternity Leave', 'Paternity Leave',
  'Special Privilege Leave', 'Solo Parent Leave', 'Study Leave', '10-Day VAWC Leave', 'Rehabilitation Leave',
  'Magna Carta of Women Special Leave/Special Leave Benefits for Women', 'Special Emergency Leave - Calamity',
  'Wellness Leave', 'Compensatory Time Off', 'Overtime', 'Others']
export const MEMO_PROGRAMS = ['GIA', 'SETUP', 'CEST', 'SSCP', 'Others']
export const EMP_STATUSES = ['Permanent/Regular', 'Contract of Service', 'Job Order', 'Casual', 'Temporary', 'Substitute', 'Coterminous', 'Others']
export const CAL_CATS = ['Meeting', 'Webinar', 'Training', 'Official Business', 'Work Suspension', 'Work From Home', 'Leave', 'Holiday', 'Event', 'Others']
export const CAT_COLORS = {
  Meeting: '#808000', Webinar: '#469990', Training: '#3cb44b', 'Official Business': '#911eb4',
  'Work Suspension': '#f58231', 'Work From Home': '#f032e6', Leave: '#000075', Holiday: '#e6194B',
  Event: '#9A6324', Others: '#a9a9a9',
}
