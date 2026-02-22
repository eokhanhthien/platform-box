async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorEl = document.getElementById('loginError');

    if (!username || !password) {
        errorEl.querySelector('span').innerText = "Vui lòng nhập tài khoản và mật khẩu";
        errorEl.style.display = 'flex';
        return;
    }

    const res = await window.api.login(username, password);
    if (res.success) {
        // Delegate routing responsibility to main process
        window.api.navigateToDashboard();
    } else {
        errorEl.querySelector('span').innerText = res.error;
        errorEl.style.display = 'flex';
    }
}
