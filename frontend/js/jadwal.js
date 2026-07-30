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
    btnEdit: document.getElementById('btn-edit-schedule'),
    btnDelete: document.getElementById('btn-delete-schedule'),
    modal: document.getElementById('schedule-modal'),
    modalOverlay: document.getElementById('modal-overlay'),
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
    confirmModal: document.getElementById('confirm-modal'),
    confirmOverlay: document.getElementById('confirm-overlay'),
    confirmMessage: document.getElementById('confirm-message'),
    btnConfirmYes: document.getElementById('btn-confirm-yes'),
    btnConfirmNo: document.getElementById('btn-confirm-no'),
};

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const ITEMS_PER_PAGE = 10;

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

        let query = sb.from('schedules').select('*').order('time', { ascending: true });

        // Filter by day
        if (activeDay && activeDay !== 'all') {
            query = query.eq('day', activeDay);
        }

        const { data, error } = await query;

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

        allSchedules = data || [];
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
        // Day filter
        if (activeDay && activeDay !== 'all' && item.day !== activeDay) return false;
        
        // Status filter
        if (filter !== 'all' && item.status !== filter) return false;
        
        // Search
        if (search) {
            const matchName = (item.name || '').toLowerCase().includes(search);
            const matchTime = (item.time || '').includes(search);
            const matchDay = (item.day || '').toLowerCase().includes(search);
            const matchAudio = (item.audio || '').toLowerCase().includes(search);
            if (!matchName && !matchTime && !matchDay && !matchAudio) return false;
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
        const tr = document.createElement('tr');
        tr.style.animation = `fadeSlideUp 0.3s ease ${index * 0.03}s both`;
        tr.innerHTML = `
            <td>${item.day}</td>
            <td><strong>${item.time?.slice(0, 5) || '--:--'}</strong></td>
            <td>${item.name || 'Bel'}</td>
            <td>${item.audio || '-'}</td>
            <td>
                <span class="badge-status ${item.status === 'active' ? 'active' : 'inactive'}">
                    ${item.status === 'active' ? 'Aktif' : 'Nonaktif'}
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
        tr.querySelector('.delete').addEventListener('click', () => confirmDelete(item.id, item.name));
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

// Preview (test audio)
async function previewSchedule(id) {
    try {
        const sb = window.initSupabase();
        if (sb) {
            const schedule = allSchedules.find(s => s.id === id);
            await sb.from('esp_commands').insert([{
                command: 'play_audio',
                params: schedule?.audio || 'default.mp3',
                status: 'pending',
                created_at: new Date().toISOString()
            }]);
            App.showToast(`Memutar ${schedule?.audio || 'default.mp3'}`, 'success');
        }
    } catch (err) {
        App.showToast('Gagal preview', 'error');
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
    jadwalDom.inputName.value = schedule.name || '';
    jadwalDom.inputDay.value = schedule.day;
    jadwalDom.inputAudio.value = schedule.audio || '';
    jadwalDom.inputStatus.value = schedule.status || 'active';
    jadwalDom.formSchedule.dataset.mode = 'edit';
    
    openModal();
}

// Open modal for add
function openAddModal() {
    editingId = null;
    jadwalDom.modalTitle.textContent = 'Tambah Jadwal Baru';
    jadwalDom.inputId.value = '';
    jadwalDom.inputTime.value = '';
    jadwalDom.inputName.value = 'Bel Pergantian Jam';
    jadwalDom.inputDay.value = activeDay;
    jadwalDom.inputAudio.value = 'default.mp3';
    jadwalDom.inputStatus.value = 'active';
    jadwalDom.formSchedule.dataset.mode = 'add';
    
    openModal();
}

function openModal() {
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

// Save schedule
async function handleSaveSchedule(e) {
    e.preventDefault();

    const mode = jadwalDom.formSchedule.dataset.mode;
    const data = {
        time: jadwalDom.inputTime.value,
        name: jadwalDom.inputName.value,
        day: jadwalDom.inputDay.value,
        audio: jadwalDom.inputAudio.value,
        status: jadwalDom.inputStatus.value,
    };

    if (!data.time || !data.day) {
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