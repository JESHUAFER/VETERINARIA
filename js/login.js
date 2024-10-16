function validateForm() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert("Por favor, rellene ambos campos.");
        return false;
    }

    if (!validateEmail(email)) {
        alert("Por favor, introduzca un correo válido.");
        return false;
    }

    return true;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}
 