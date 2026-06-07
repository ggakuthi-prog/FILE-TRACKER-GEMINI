async function apiFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    options.headers['Content-Type'] = 'application/json';
    const res = await fetch(url, options);
    if (res.status === 401) {
        document.getElementById('main-panel').classList.add('hidden');
        document.getElementById('login-panel').classList.remove('hidden');
        return null;
    }
    return res.json();
}

async function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const data = await apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ username: user, password: pass }) });
    
    if (data && data.success) {
        document.getElementById('login-panel').classList.add('hidden');
        document.getElementById('main-panel').classList.remove('hidden');
        document.getElementById('user-display').innerText = data.username;
        loadDepartments();
        searchFiles();
    } else {
        alert("Security Warning: Authentication Rejected.");
    }
}

async function logout() {
    await apiFetch('/api/logout', { method: 'POST' });
    location.reload();
}

async function loadDepartments() {
    const depts = await apiFetch('/api/departments');
    if (!depts) return;
    const newDeptSel = document.getElementById('new-dept');
    const moveDeptSel = document.getElementById('move-dept');
    
    newDeptSel.innerHTML = '';
    moveDeptSel.innerHTML = '';
    
    depts.forEach(d => {
        const opt = `<option value="${d.id}">${d.name}</option>`;
        newDeptSel.innerHTML += opt;
        moveDeptSel.innerHTML += opt;
    });
}

async function searchFiles() {
    const q = document.getElementById('search-input').value;
    const files = await apiFetch(`/api/files/search?q=${encodeURIComponent(q)}`);
    if (!files) return;
    
    const tbody = document.querySelector('#files-table tbody');
    tbody.innerHTML = '';
    
    files.forEach(f => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${f.file_reference}</strong></td>
                <td>${f.title}</td>
                <td>${f.department_name}</td>
                <td>${f.current_user}</td>
                <td>
                    <button onclick="prepareMove(${f.id}, '${f.file_reference}')" style="padding:4px 8px; width:auto; font-size:12px;">Transfer</button>
                    <button onclick="loadHistory(${f.id}, '${f.file_reference}')" style="padding:4px 8px; width:auto; font-size:12px; background:#4a5568;">Audit</button>
                </td>
            </tr>`;
    });
}

async function createFile() {
    const payload = {
        file_reference: document.getElementById('new-ref').value,
        title: document.getElementById('new-title').value,
        department_id: document.getElementById('new-dept').value,
        current_user: document.getElementById('new-user').value
    };
    const res = await apiFetch('/api/files', { method: 'POST', body: JSON.stringify(payload) });
    if(res && res.success) {
        searchFiles();
        alert("File registered successfully.");
    } else {
        alert(res.error || "Failed to create file.");
    }
}

function prepareMove(id, ref) {
    document.getElementById('move-file-id').value = id;
    document.getElementById('move-file-ref').innerText = `Transfer File Reference: ${ref}`;
}

async function moveFile() {
    const payload = {
        file_id: document.getElementById('move-file-id').value,
        target_department_id: document.getElementById('move-dept').value,
        next_user: document.getElementById('move-user').value
    };
    if(!payload.file_id) return alert("Select a file first.");
    
    const res = await apiFetch('/api/files/move', { method: 'POST', body: JSON.stringify(payload) });
    if (res && res.success) {
        searchFiles();
        alert("File transferred successfully.");
    }
}

async function loadHistory(id, ref) {
    document.getElementById('history-title').innerText = ref;
    const history = await apiFetch(`/api/files/${id}/history`);
    const tbody = document.querySelector('#history-table tbody');
    tbody.innerHTML = '';
    
    history.forEach(h => {
        const badge = h.action_type === 'IN' ? '<span class="badge in">CHECK IN</span>' : '<span class="badge out">CHECK OUT</span>';
        tbody.innerHTML += `
            <tr>
                <td>${badge}</td>
                <td>${h.department_name}</td>
                <td>${new Date(h.timestamp).toLocaleString()}</td>
                <td>${h.handled_by}</td>
            </tr>`;
    });
}
