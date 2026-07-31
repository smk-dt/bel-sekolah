// ============================================
// SMART SCHOOL BELL IoT - Schedule Page
// ============================================

// ============================================
// DOM REFS
// ============================================
const jadwalDom = {
    dayTabsContainer: document.getElementById('day-tabs'),
    tableBody: document.getElementById('schedule-table-body'),
    searchInput: document.getElementById('jadwal-search-input'),
    filterSelect: document.getElementById('jadwal-filter'),
    pagination: document.getElementById('schedule-pagination'),
    btnAdd: document.getElementById('btn-add-schedule'),
    modal: document.getElementById('schedule-modal'),
    modalOverlay: document.getElementById('schedule-modal-overlay'),
    modalTitle: document.getElementById('schedule-modal-title'),
    formSchedule: document.getElementById('form-schedule'),
    inputId: document.getElementById('sched-id'),
    inputTime: document.getElementById('sched-time'),
    inputName: document.getElementById('sched-name'),
    inputDay: document.getElementById('sched-day'),
    inputAudio: document.getElementById('sched-audio'),
    inputStatus: document.getElementById('sched-status'),
    btnModalSave: document.getElementById('btn-modal-save'),
    btnModalCancel: document.getElementById('btn-modal-cancel'),
    btnModalCancel2: document.getElementById('btn-modal-cancel2'),
    confirmModal: document.getElementById('confirm-modal'),
    confirmOverlay: document.getElementById('confirm-overlay'),
    confirmMessage: document.getElementById('confirm-message'),
    btnConfirmYes: document.getElementById('btn-confirm-yes'),
    btnConfirmNo: document.getElementById('btn-confirm-no'),
};

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_MAP = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };
const ITEMS_PER_PAGE = 10;

// ============================================
// DAY-OF-WEEK HELPERS
// Support both Postgres int[] ([1,2,3]) and legacy CSV string ("1,2,3")
// ============================================
function parseDayOfWeek(value) {
    if (Array.isArray(value)) {
        return value.map(v => parseInt(v)).filter(n => !isNaN(n));
    }
    return String(value || '')
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n));
}

function formatDayOfWeekForDisplay(value) {
    return parseDayOfWeek(value)
        .filter(n => n >= 1 && n <= 6)
        .map(n => DAY_NAMES[n - 1])
        .join(', ');
}

function formatDayOfWeekForSave(value) {
    return parseDayOfWeek(value);
}

// ============================================
// STATE
// ============================================
let activeDay = 'Senin';
let allSchedules = [];
let filteredSchedules = [];
let currentPage = 1;
let editingId = null;
let deleteTargetId = null;

// ============================================
// AUDIO FILES (SD Card: 0001.mp3 - 0016.mp3)
// ============================================
const AUDIO_FILES = [];
for (let i = 1; i <= 16; i++) {
    const num = String(i).padStart(4, '0');
    AUDIO_FILES.push({ value: i, label: `${num}.mp3` });
}

// ============================================
// DAY TABS
// ============================================
function renderDayTabs() {
    const container = jadwalDom.dayTabsContainer;
    if (!container) return;

    container.innerHTML = '';
    
    DAY_NAMES.forEach(day => {
        const btn = document.createElement('button');
        btn.className = `day-tab ${day === activeDay ? 'active' : ''}`;
        btn.dataset.day = day;
        btn.textContent = day;
        btn.addEventListener('click', () => {
            activeDay = day;
            renderDayTabs();
            loadScheduleData(day);
        });
        container.appendChild(btn);
    });
}

// ============================================
// LOAD SCHEDULE DATA
// ============================================
async function loadScheduleData(day) {
    activeDay = day || activeDay;
    currentPage = 1;

    const container = jadwalDom.tableBody;
    if (!container) return;

    try {
        App.showSkeleton('schedule-table-body', 'table', 5);
        
        const sb = window.initSupabase();
        if (!sb) {
            container.innerHTML = `
                <tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-light);">
                    <i class="bi bi-database-slash" style="font-size:32px; display:block; margin-bottom:8px;"></i>
                    Tidak dapat terhubung ke database
                </td></tr>
            `;
            return;
        }

        // Fetch schedules (audio_id = track number DFPlayer 1-16, tanpa join tabel audios)
        const { data, error } = await sb
            .from('schedules')
            .select('*')
            .order('time', { ascending: true });

        if (error) {
            console.error('[Jadwal] Fetch error:', error);
            container.innerHTML = `
                <tr><td colspan="6" style="text-align:center; padding:24px; color:var(--danger);">
                    <i class="bi bi-exclamation-triangle" style="font-size:32px; display:block; margin-bottom:8px;"></i>
                    Gagal memuat jadwal: ${error.message}
                </td></tr>
            `;
            return;
        }

        // Transform data to match frontend model
        // audio_id = track number DFPlayer (1-16), file 0001.mp3 - 0016.mp3
        allSchedules = (data || []).map(item => ({
            id: item.id,
            day_of_week: item.day_of_week,
            time: item.time,
            audio_id: item.audio_id,
            enabled: item.enabled,
            device_id: item.device_id,
            // Derived fields for display
            audio_name: `Bel (Track ${item.audio_id})`,
            track_number: item.audio_id,
            // Format audio file name from track number
            audio_file: item.audio_id
                ? String(item.audio_id).padStart(4, '0') + '.mp3'
                : '-',
        }));

        applyFilters();

    } catch (err) {
        console.error('[Jadwal] Error:', err);
        container.innerHTML = `
            <tr><td colspan="6" style="text-align:center; padding:24px; color:var(--danger);">
                <i class="bi bi-exclamation-triangle" style="font-size:32px; display:block; margin-bottom:8px;"></i>
                ${err.message}
            </td></tr>
        `;
    }
}

// ============================================
// FILTERS
// ============================================
function applyFilters() {
    const search = (jadwalDom.searchInput?.value || '').toLowerCase();
    const filter = jadwalDom.filterSelect?.value || 'all';

    filteredSchedules = allSchedules.filter(item => {
        // Day filter using day_of_week (contains day number)
        if (activeDay && activeDay !== 'all') {
            const dayNum = DAY_MAP[activeDay];
            const days = parseDayOfWeek(item.day_of_week);
            if (!days.includes(dayNum)) return false;
        }
        
        // Status filter
        if (filter !== 'all') {
            const isActive = item.enabled === true;
            if (filter === 'active' && !isActive) return false;
            if (filter === 'inactive' && isActive) return false;
        }
        
        // Search
        if (search) {
            const audioName = (item.audio_name || '').toLowerCase();
            const audioFile = (item.audio_file || '').toLowerCase();
            const time = (item.time || '').includes(search);
            const dayMatch = DAY_NAMES.some(d => {
                const dn = DAY_MAP[d];
                return parseDayOfWeek(item.day_of_week).includes(dn) && d.toLowerCase().includes(search);
            });
            if (!audioName.includes(search) && !audioFile.includes(search) && !time && !dayMatch) return false;
        }
        
        return true;
    });

    // Pagination
    const totalPages = Math.ceil(filteredSchedules.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filteredSchedules.slice(start, start + ITEMS_PER_PAGE);

    renderTable(pageItems);
    renderPagination(totalPages);
}

// ============================================
// RENDER TABLE
// ============================================
function renderTable(items) {
    const container = jadwalDom.tableBody;
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `
            <tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-light);">
                <i class="bi bi-inbox" style="font-size:40px; display:block; margin-bottom:8px;"></i>
                Tidak ada jadwal untuk ${activeDay}
            </td></tr>
        `;
        return;
    }

    container.innerHTML = '';
    
    items.forEach((item, index) => {
        // Compute day names from day_of_week (array or CSV string)
        const dayNames = formatDayOfWeekForDisplay(item.day_of_week);

        const tr = document.createElement('tr');
        tr.style.animation = `fadeSlideUp 0.3s ease ${index * 0.03}s both`;
        tr.innerHTML = `
            <td>${dayNames}</td>
            <td><strong>${item.time?.slice(0, 5) || '--:--'}</strong></td>
            <td>${item.audio_name}</td>
            <td>${item.audio_file}</td>
            <td>
                <span class="badge-status ${item.enabled ? 'active' : 'inactive'}">
                    ${item.enabled ? 'Aktif' : 'Nonaktif'}
                </span>
            </td>
            <td>
                <div style="display:flex; gap:6px;">
                    <button class="action-btn preview" data-id="${item.id}" title="Preview">
                        <i class="bi bi-play-fill"></i>
                    </button>
                    <button class="action-btn edit" data-id="${item.id}" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="action-btn delete" data-id="${item.id}" title="Hapus">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
            </td>
        `;
        container.appendChild(tr);

        // Event listeners for action buttons
        tr.querySelector('.preview').addEventListener('click', () => previewSchedule(item.id));
        tr.querySelector('.edit').addEventListener('click', () => editSchedule(item.id));
        tr.querySelector('.delete').addEventListener('click', () => confirmDelete(item.id, item.audio_name));
    });
}

// ============================================
// PAGINATION
// ============================================
function renderPagination(totalPages) {
    const container = jadwalDom.pagination;
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    
    // Prev
    html += `<li class="${currentPage <= 1 ? 'disabled' : ''}">
        <button data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>
            <i class="bi bi-chevron-left"></i>
        </button>
    </li>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `<li class="${i === currentPage ? 'active' : ''}">
            <button data-page="${i}">${i}</button>
        </li>`;
    }

    // Next
    html += `<li class="${currentPage >= totalPages ? 'disabled' : ''}">
        <button data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>
            <i class="bi bi-chevron-right"></i>
        </button>
    </li>`;

    container.innerHTML = html;

    // Event listeners
    container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = parseInt(this.dataset.page);
            if (!isNaN(page) && page >= 1 && page <= totalPages) {
                currentPage = page;
                applyFilters();
            }
        });
    });
}

// ============================================
// CRUD OPERATIONS
// ============================================

// Preview (test audio via ESP32)
async function previewSchedule(id) {
    try {
        const sb = window.initSupabase();
        if (!sb) {
            App.showToast('Database tidak terhubung', 'error');
            return;
        }

        const schedule = allSchedules.find(s => s.id === id);
        if (!schedule) {
            App.showToast('Jadwal tidak ditemukan', 'error');
            return;
        }

        // Get device_id from first registered device
        const { data: devices } = await sb.from('devices').select('device_id').limit(1);
        if (!devices || devices.length === 0) {
            App.showToast('Tidak ada perangkat terdaftar', 'error');
            return;
        }

        await sb.from('esp_commands').insert([{
            device_id: devices[0].device_id,
            command: 'test_audio',
            params: String(schedule.track_number || 1),
            status: 'pending',
            created_at: new Date().toISOString()
        }]);

        App.showToast(`Perintah test audio track ${schedule.track_number || 1} dikirim`, 'success');
    } catch (err) {
        console.error('[Jadwal] Preview error:', err);
        App.showToast('Gagal preview: ' + err.message, 'error');
    }
}

// Edit
function editSchedule(id) {
    const schedule = allSchedules.find(s => s.id === id);
    if (!schedule) return;

    editingId = id;
    jadwalDom.modalTitle.textContent = 'Edit Jadwal';
    jadwalDom.inputId.value = schedule.id;
    jadwalDom.inputTime.value = schedule.time?.slice(0, 5) || '';
    jadwalDom.inputName.value = schedule.audio_name || '';
    jadwalDom.inputDay.value = parseDayOfWeek(schedule.day_of_week).join(',') || '1,2,3,4,5';
    jadwalDom.inputAudio.value = schedule.track_number || 1;
    jadwalDom.inputStatus.value = schedule.enabled ? 'active' : 'inactive';
    jadwalDom.formSchedule.dataset.mode = 'edit';
    
    openModal();
}

// Open modal for add
function openAddModal() {
    editingId = null;
    jadwalDom.modalTitle.textContent = 'Tambah Jadwal Baru';
    jadwalDom.inputId.value = '';
    jadwalDom.inputTime.value = '07:00';
    jadwalDom.inputName.value = '';
    jadwalDom.inputDay.value = String(DAY_MAP[activeDay] || 1);
    jadwalDom.inputAudio.value = 1;
    jadwalDom.inputStatus.value = 'active';
    jadwalDom.formSchedule.dataset.mode = 'add';
    
    openModal();
}

// Open modal and populate audio dropdown
function openModal() {
    // Populate audio dropdown (Problem 6 fix)
    populateAudioDropdown();
    
    jadwalDom.modal.classList.remove('d-none');
    jadwalDom.modalOverlay.classList.remove('d-none');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    jadwalDom.modal.classList.add('d-none');
    jadwalDom.modalOverlay.classList.add('d-none');
    document.body.style.overflow = '';
    editingId = null;
}

// ============================================
// AUDIO DROPDOWN
// ============================================
function populateAudioDropdown() {
    const select = jadwalDom.inputAudio;
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '';

    AUDIO_FILES.forEach(audio => {
        const option = document.createElement('option');
        option.value = audio.value;
        option.textContent = audio.label;
        select.appendChild(option);
    });

    // Restore selected value if editing
    if (currentValue) {
        select.value = currentValue;
    }
}

// ============================================
// DAY-OF-WEEK CHECKBOX HANDLER
// ============================================
// The sched-day select stores day_of_week as comma-separated numbers
// For simplicity, we use day_of_week string directly in the hidden field
// The UI shows day tabs, but for add/edit we store the numeric format

// Save schedule
async function handleSaveSchedule(e) {
    e.preventDefault();

    const mode = jadwalDom.formSchedule.dataset.mode;
    const audioId = parseInt(jadwalDom.inputAudio.value) || 1;
    const enabled = jadwalDom.inputStatus.value === 'active';

    // Build data matching database schema
    // day_of_week disimpan sebagai int[] (Postgres array)
    const data = {
        audio_id: audioId,
        day_of_week: formatDayOfWeekForSave(jadwalDom.inputDay.value),
        time: jadwalDom.inputTime.value,
        enabled: enabled,
    };

    if (!data.time || !data.day_of_week) {
        App.showToast('Waktu dan hari harus diisi', 'warning');
        return;
    }

    jadwalDom.btnModalSave.disabled = true;
    jadwalDom.btnModalSave.textContent = 'Menyimpan...';

    try {
        const sb = window.initSupabase();
        if (!sb) {
            App.showToast('Database tidak terhubung', 'error');
            return;
        }

        if (mode === 'edit') {
            const id = jadwalDom.inputId.value;
            const { error } = await sb.from('schedules').update(data).eq('id', id);
            if (error) throw error;
            App.showToast('Jadwal berhasil diperbarui', 'success');
        } else {
            const { error } = await sb.from('schedules').insert([data]);
            if (error) throw error;
            App.showToast('Jadwal baru berhasil ditambahkan', 'success');
        }

        closeModal();
        loadScheduleData(activeDay);

    } catch (err) {
        console.error('[Jadwal] Save error:', err);
        App.showToast('Gagal menyimpan: ' + err.message, 'error');
    } finally {
        jadwalDom.btnModalSave.disabled = false;
        jadwalDom.btnModalSave.textContent = 'Simpan';
    }
}

// Delete confirmation
function confirmDelete(id, name) {
    deleteTargetId = id;
    jadwalDom.confirmMessage.innerHTML = `
        <i class="bi bi-exclamation-triangle" style="font-size:40px; color:var(--danger); display:block; margin-bottom:12px;"></i>
        Yakin ingin menghapus jadwal <strong>"${name || 'Bel'}"</strong>?<br>
        <span style="font-size:13px; color:var(--text-light);">Tindakan ini tidak dapat dibatalkan.</span>
    `;
    jadwalDom.confirmModal.classList.remove('d-none');
    jadwalDom.confirmOverlay.classList.remove('d-none');
}

async function handleConfirmDelete() {
    if (!deleteTargetId) return;

    try {
        const sb = window.initSupabase();
        if (!sb) {
            App.showToast('Database tidak terhubung', 'error');
            return;
        }

        const { error } = await sb.from('schedules').delete().eq('id', deleteTargetId);
        if (error) throw error;

        App.showToast('Jadwal berhasil dihapus', 'success');
        closeConfirmModal();
        loadScheduleData(activeDay);

    } catch (err) {
        console.error('[Jadwal] Delete error:', err);
        App.showToast('Gagal menghapus: ' + err.message, 'error');
    } finally {
        deleteTargetId = null;
    }
}

function closeConfirmModal() {
    jadwalDom.confirmModal.classList.add('d-none');
    jadwalDom.confirmOverlay.classList.add('d-none');
    deleteTargetId = null;
}

// ============================================
// EVENT LISTENERS
// ============================================

// Search input with debounce
let searchTimer = null;
if (jadwalDom.searchInput) {
    jadwalDom.searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentPage = 1;
            applyFilters();
        }, 300);
    });
}

// Filter select
if (jadwalDom.filterSelect) {
    jadwalDom.filterSelect.addEventListener('change', function() {
        currentPage = 1;
        applyFilters();
    });
}

// Add button
if (jadwalDom.btnAdd) {
    jadwalDom.btnAdd.addEventListener('click', openAddModal);
}

// Form submit
if (jadwalDom.formSchedule) {
    jadwalDom.formSchedule.addEventListener('submit', handleSaveSchedule);
}

// Modal close buttons
if (jadwalDom.btnModalCancel) {
    jadwalDom.btnModalCancel.addEventListener('click', closeModal);
}
if (jadwalDom.btnModalCancel2) {
    jadwalDom.btnModalCancel2.addEventListener('click', closeModal);
}
if (jadwalDom.modalOverlay) {
    jadwalDom.modalOverlay.addEventListener('click', closeModal);
}

// Confirm modal
if (jadwalDom.btnConfirmYes) {
    jadwalDom.btnConfirmYes.addEventListener('click', handleConfirmDelete);
}
if (jadwalDom.btnConfirmNo) {
    jadwalDom.btnConfirmNo.addEventListener('click', closeConfirmModal);
}
if (jadwalDom.confirmOverlay) {
    jadwalDom.confirmOverlay.addEventListener('click', closeConfirmModal);
}

// Keyboard shortcut for search
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        jadwalDom.searchInput?.focus();
    }
});

// ============================================
// INIT
// ============================================
renderDayTabs();
console.log('[Jadwal] Module loaded');