document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');

    loginBtn.addEventListener('click', () => {
        window.location.href = `${process.env.LOGIN_URL}`;
    });

});
