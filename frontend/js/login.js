
    document.getElementById('loginForm').addEventListener('submit', async function (event) {
        event.preventDefault(); // Evitar que el formulario se envíe normalmente
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            const response = await fetch('http://127.0.0.1:3001/login', { // Asegúrate de que la ruta es correcta
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok) {
                alert('Login exitoso');
                window.location.href = '/cuenta/dashboard.html'; // Redirigir al dashboard o cualquier otra página
            } else {
                alert(data.message || 'Error al iniciar sesión');
            }
        } catch (error) {
            console.error('Error en la petición', error);
            alert('Hubo un error con la solicitud. Inténtelo más tarde.');
        }
    });
    