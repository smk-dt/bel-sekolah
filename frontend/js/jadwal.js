// ============================================
// SMART SCHOOL BELL IoT - Jadwal (Schedule) Page
// ============================================

let currentDay = 'Senin';
let currentPage = 1;
const ITEMS_PER_PAGE = 20;
let scheduleModal = null;

// Initialize modal
document.addEventListener('DOMContentLoaded', function() {
    scheduleModal = new bootstrap.Modal(document.getElementById('modalSchedule'));
});

// Load schedule data
async function loadScheduleData(day) {
    try {
        const sb = initSupabase();
        currentDay = day || getCurrentDayName();
        
        const tbody = document.getElementById('jadwal-tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="text-muted mt-2 mb-0">Memuat jadwal...</p>
                </td>
            </tr>
        `;
        
        // Get schedules with audio info
        const { data: schedules, error } = await sb
            .from('schedules')
            .select('*, audios(audio_name, audio_file)')
            .eq('day', currentDay)
            .order('time', { ascending: true });
        
        if (error) throw error;
        
        if (!schedules || schedules.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-muted">
                        <i class="bi bi-calendar-x fs-2 d-block mb-2"></i>
                        Tidak ada jadwal untuk hari ${currentDay}
                    </td>
                </tr>
            `;
            return;
        }
        
        renderScheduleTable(schedules);
    } catch (err) {
        console.error('[Jadwal] Load error:', err);
        document.getElementById('jadwal-tbody').innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle fs-2 d-block mb-2"></i>
                    Gagal memuat jadwal: ${err.message}
                </td>
            </tr>
        `;
    }
}

// Render schedule table
function renderScheduleTable(schedules) {
    const tbody = document.getElementById('jadwal-tbody');
    const filterStatus = document.getElementById('filter-status').value;
    const searchQuery = document.getElementById('search-jadwal').value.toLowerCase();
    
    // Filter
    let filtered = schedules;
    if (filterStatus !== 'all') {
        filtered = filtered.filter(s => s.status === filterStatus);
    }
    if (searchQuery) {
        filtered = filtered.filter(s => 
            s.audios?.audio_name?.toLowerCase().includes(searchQuery) ||
            s.time?.includes(searchQuery)
        );
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-muted">
                    Tidak ada hasil pencarian
                </td>
            </tr>
        `;
        return;
    }
    
    // Pagination
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = 1;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);
    
    let html = '';
    pageItems.forEach((s, index) => {
        const num = start + index + 1;
        const audioName = s.audios?.audio_name || 'Unknown';
        const audioFile = s.audios?.audio_file || '';
        
        html += `
            <tr class="${s.status === 'active' ? '' : 'table-secondary'}">
                <td class="text-center fw-semibold">${num}</td>
                <td>${s.day}</td>
                <td class="fw-semibold">${s.time.slice(0, 5)}</td>
                <td>${audioName}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-warning btn-preview-audio" 
                            data-audio="${audioFile}" title="Preview Audio">
                        <i class="bi bi-play-fill"></i>
                    </button>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary btn-edit-schedule" 
                            data-id="${s.id}" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger btn-delete-schedule" 
                            data-id="${s.id}" title="Hapus">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
                <td class="text-center">
                    <span class="badge ${s.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                        ${s.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Render pagination
    renderPagination(totalPages);
    
    // Attach events
    attachScheduleEvents();
}

// Render pagination
function renderPagination(totalPages) {
    const pagination = document.querySelector('#jadwal-pagination ul');
    if (!pagination) return;
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    html += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <button class="page-link" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>
    `;
    
    for (let i = 1; i <= totalPages; i++) {
        html += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <button class="page-link ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>
            </li>
        `;
    }
    
    html += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <button class="page-link" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;
    
    pagination.innerHTML = html;
    
    // Attach pagination events
    pagination.querySelectorAll('.page-link').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = parseInt(this.dataset.page);
            if (page && page !== currentPage) {
                currentPage = page;
                loadScheduleData(currentDay);
            }
        });
    });
}

// Attach schedule button events
function attachScheduleEvents() {
    // Edit buttons
    document.querySelectorAll('.btn-edit-schedule').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            openEditModal(id);
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.btn-delete-schedule').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            confirmDeleteSchedule(id);
        });
    });
    
    // Preview audio buttons
    document.querySelectorAll('.btn-preview-audio').forEach(btn => {
        btn.addEventListener('click', function() {
            const audioFile = this.dataset.audio;
            previewAudio(audioFile);
        });
    });
}

// Open modal for new schedule
async function openAddModal() {
    document.getElementById('modalScheduleTitle').textContent = 'Tambah Jadwal';
    document.getElementById('schedule-id').value = '';
    document.getElementById('form-schedule').reset();
    document.getElementById('schedule-day').value = currentDay;
    document.getElementById('schedule-status').value = 'active';
    
    await loadAudioOptions();
    scheduleModal.show();
}

// Open modal for edit schedule
async function openEditModal(id) {
    try {
        const sb = initSupabase();
        document.getElementById('modalScheduleTitle').textContent = 'Edit Jadwal';
        
        const { data: schedule, error } = await sb
            .from('schedules')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        document.getElementById('schedule-id').value = schedule.id;
        document.getElementById('schedule-day').value = schedule.day;
        document.getElementById('schedule-time').value = schedule.time.slice(0, 5);
        document.getElementById('schedule-status').value = schedule.status;
        
        await loadAudioOptions(schedule.audio_id);
        scheduleModal.show();
    } catch (err) {
        console.error('[Jadwal] Edit error:', err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal',
            text: err.message
        });
    }
}

// Load audio options into select
async function loadAudioOptions(selectedId) {
    try {
        const sb = initSupabase();
        const { data: audios, error } = await sb
            .from('audios')
            .select('*')
            .order('id', { ascending: true });
        
        if (error) throw error;
        
        const select = document.getElementById('schedule-audio');
        select.innerHTML = '<option value="">Pilih Audio</option>';
        
        audios.forEach(audio => {
            const option = document.createElement('option');
            option.value = audio.id;
            option.textContent = audio.audio_name;
            if (selectedId && audio.id === selectedId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    } catch (err) {
        console.error('[Jadwal] Load audio error:', err);
    }
}

// Save schedule (create or update)
async function saveSchedule() {
    const id = document.getElementById('schedule-id').value;
    const day = document.getElementById('schedule-day').value;
    const time = document.getElementById('schedule-time').value;
    const audioId = document.getElementById('schedule-audio').value;
    const status = document.getElementById('schedule-status').value;
    
    if (!day || !time || !audioId) {
        Swal.fire({
            icon: 'warning',
            title: 'Lengkapi data',
            text: 'Semua field harus diisi'
        });
        return;
    }
    
    const btnSave = document.getElementById('btn-save-schedule');
    const saveText = document.getElementById('save-text');
    const saveSpinner = document.getElementById('save-spinner');
    
    btnSave.disabled = true;
    saveText.textContent = 'Menyimpan...';
    saveSpinner.classList.remove('d-none');
    
    try {
        const sb = initSupabase();
        const data = {
            day,
            time: time + ':00',
            audio_id: parseInt(audioId),
            status
        };
        
        if (id) {
            // Update
            const { error } = await sb
                .from('schedules')
                .update(data)
                .eq('id', id);
            
            if (error) throw error;
            
            Swal.fire({
                icon: 'success',
                title: 'Jadwal Diperbarui',
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } else {
            // Insert
            const { error } = await sb
                .from('schedules')
                .insert(data);
            
            if (error) {
                if (error.code === '23505') {
                    throw new Error('Jadwal untuk hari dan jam tersebut sudah ada');
                }
                throw error;
            }
            
            Swal.fire({
                icon: 'success',
                title: 'Jadwal Ditambahkan',
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }
        
        scheduleModal.hide();
        loadScheduleData(currentDay);
    } catch (err) {
        console.error('[Jadwal] Save error:', err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal',
            text: err.message
        });
    } finally {
        btnSave.disabled = false;
        saveText.textContent = 'Simpan';
        saveSpinner.classList.add('d-none');
    }
}

// Confirm delete schedule
function confirmDeleteSchedule(id) {
    Swal.fire({
        title: 'Hapus Jadwal?',
        text: 'Anda yakin ingin menghapus jadwal ini?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const sb = initSupabase();
                const { error } = await sb
                    .from('schedules')
                    .delete()
                    .eq('id', id);
                
                if (error) throw error;
                
                Swal.fire({
                    icon: 'success',
                    title: 'Jadwal Dihapus',
                    timer: 1500,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
                
                loadScheduleData(currentDay);
            } catch (err) {
                console.error('[Jadwal] Delete error:', err);
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal',
                    text: err.message
                });
            }
        }
    });
}

// Preview audio (placeholder - actual preview would need audio files)
function previewAudio(audioFile) {
    // In production, this would play the audio file from Supabase storage
    Swal.fire({
        icon: 'info',
        title: 'Preview Audio',
        text: `Memutar: ${audioFile}`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}

// Setup jadwal event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Day selector
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentDay = this.dataset.day;
            currentPage = 1;
            loadScheduleData(currentDay);
        });
    });
    
    // Add schedule button
    document.getElementById('btn-add-schedule').addEventListener('click', openAddModal);
    
    // Save schedule button
    document.getElementById('btn-save-schedule').addEventListener('click', saveSchedule);
    
    // Search
    document.getElementById('search-jadwal').addEventListener('input', function() {
        currentPage = 1;
        loadScheduleData(currentDay);
    });
    
    // Filter status
    document.getElementById('filter-status').addEventListener('change', function() {
        currentPage = 1;
        loadScheduleData(currentDay);
    });
    
    // Reset modal on close
    document.getElementById('modalSchedule').addEventListener('hidden.bs.modal', function() {
        document.getElementById('form-schedule').reset();
    });
});