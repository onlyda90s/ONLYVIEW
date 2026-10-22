export const store = {
  currentUser: null,
  targetUserId: null,
  isReadOnly: false,
  rawCampaignList: [],
  isBatchEditing: false,
  listSubTab: 'ongoing',
  settlementSubTab: 'report',
  isFilterExpanded: false,
  newBatchRows: [],
  charts: { yearly: null, monthly: null, monthlyAnalysis: null },
  isSidebarCollapsed: localStorage.getItem('onlyview_sidebarCollapsed') === 'true',
  monthlyDetailsCollapseState: {},
  sortColumn: localStorage.getItem('onlyview_sortColumn') || 'none',
  sortAsc: localStorage.getItem('onlyview_sortAsc') === 'true',
  myCustomCode: "",
  currentCalDate: new Date(),
  selectedStatus: "신청",
  modalSelectedStatus: "신청",
  editSelectedStatus: "선정",
  editingId: null,
  activeColorPickerKey: null,
  deadlineAlertDays: 7,
  platformList: JSON.parse(localStorage.getItem('onlyview_platforms')) || ['개별', '리뷰노트', '레뷰', '디너의여왕'],
  customStatusColors: {
    apply: '#6B7280', select: '#111827', visit: '#F4A261', unsubmitted: '#E63946',
    submit: '#059669', delivery: '#2563EB', fee: '#9333EA'
  },
  currentChartMode: localStorage.getItem('onlyview_chartMode') || 'default',
  presetPalette: [
    '#6B7280', '#111827', '#E63946', '#F4A261', '#E9C46A',
    '#059669', '#2563EB', '#4F46E5', '#9333EA', '#D97706',
    '#EC4899', '#0891B2'
  ],
  chartStylePalettes: {
    default: { highlight: '#335A90', main: '#658EC6', pending: '#B2C6E2', isOutline: false },
    light:   { highlight: '#2F5FA8', main: '#5C8FD6', pending: '#A9C6EC', isOutline: false },
    outline: { highlightBorder: '#3F73C2', highlightFill: '#9DB8E3', mainBorder: '#4F82CC', mainFill: '#C7D7EE', pendingBorder: '#4F82CC', pendingFill: '#E3EAF5', isOutline: true },
    themePreset: {
      slate: { highlight: '#335A90', main: '#658EC6', pending: '#B2C6E2' },
      terracotta: { highlight: '#994A20', main: '#CF7B4F', pending: '#E7BCA5' },
      forest: { highlight: '#2A583F', main: '#5B8B71', pending: '#ACC4B7' },
      violet: { highlight: '#58419A', main: '#8C75CF', pending: '#C6BAE7' },
      graphite: { highlight: '#272B31', main: '#595C61', pending: '#ACADB0' },
      brick: { highlight: '#8D3029', main: '#C3635B', pending: '#E1B0AC' },
      mustard: { highlight: '#7D5705', main: '#B28A36', pending: '#D9C598' },
      indigo: { highlight: '#2C3B89', main: '#606EBB', pending: '#AFB6DD' },
      emerald: { highlight: '#0F6554', main: '#429887', pending: '#A0CCC3' },
      ink: { highlight: '#20242B', main: '#53575D', pending: '#AAABAF' }
    }
  },
  themeColors: {
    slate: { primary: '#3B6FB6', hover: '#2C5796', text: '#3B6FB6', light: '#E5EBF4', bg: '#F4F6F9', sidebarBg: '#E5EBF4', sidebarText: '#333333' },
    terracotta: { primary: '#C2571F', hover: '#A04313', text: '#C2571F', light: '#F4E7DD', bg: '#F8F3EE', sidebarBg: '#F4E7DD', sidebarText: '#333333' },
    forest: { primary: '#2E6B4A', hover: '#225238', text: '#2E6B4A', light: '#E1EAE4', bg: '#F4F7F5', sidebarBg: '#E1EAE4', sidebarText: '#333333' },
    violet: { primary: '#6D4FC2', hover: '#553BA3', text: '#6D4FC2', light: '#EAE6F6', bg: '#F3F3F4', sidebarBg: '#EAE6F6', sidebarText: '#333333' },
    graphite: { primary: '#2B2F36', hover: '#191C21', text: '#2B2F36', light: '#E3E3E5', bg: '#F3F3F4', sidebarBg: '#E3E3E5', sidebarText: '#333333' },
    brick: { primary: '#B2382F', hover: '#8E2820', text: '#B2382F', light: '#F3E4E1', bg: '#F9F3F1', sidebarBg: '#F3E4E1', sidebarText: '#333333' },
    mustard: { primary: '#9C6A00', hover: '#7A5200', text: '#9C6A00', light: '#F2EBD7', bg: '#FAF6EA', sidebarBg: '#F2EBD7', sidebarText: '#333333' },
    indigo: { primary: '#3446A8', hover: '#253488', text: '#3446A8', light: '#E8EBF8', bg: '#F2F4FA', sidebarBg: '#1D2760', sidebarText: '#E6E8EE' },
    emerald: { primary: '#0E7C66', hover: '#095E4D', text: '#0E7C66', light: '#DCEDE9', bg: '#EEF7F4', sidebarBg: '#DCEDE9', sidebarText: '#333333' },
    ink: { primary: '#232830', hover: '#14171C', text: '#232830', light: '#E2E5EB', bg: '#F4F4F6', sidebarBg: '#16181D', sidebarText: '#E6E8EE' }
  }
};
