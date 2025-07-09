// public/main.js  (versión con token incluido)
// --- fragmento relevante ---
async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  // Obtén el token v2 invisible
  const token = await grecaptcha.execute('6LdNAXUrAAAAAIz5Vi5nLnkSHF-fjoTXPSKa2x6y', { action: 'submit' });

  // Añade el token al payload
  const payload = { ...data, token };

  // Envío vía fetch al API route
  const res = await fetch('/api/registrar.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  if (json.success) {
    showSuccessModal();
  } else {
    showErrorModal(json.message || 'Ocurrió un error');
  }
}

document.getElementById('form').addEventListener('submit', handleSubmit);
