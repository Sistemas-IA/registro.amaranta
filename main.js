document.addEventListener("DOMContentLoaded", async () => {
  const tokenInput = document.getElementById("token");
  const modal = document.getElementById("modalExpirado");
  const form = document.getElementById("registroForm");
  const btnSubmit = document.getElementById("btnSubmit");

  try {
    const res = await fetch("https://script.google.com/macros/s/AKfycby6QcUYeEgJv2B1EIZMTaFGM7b0slo7R06gH0vHHOTiahU8AIJ1-2K7RTXgZh8GvSpGDw/exec");
    const data = await res.json();
    if (data.token) {
      tokenInput.value = data.token;
    } else {
      modal.classList.remove("hidden");
    }
  } catch (e) {
    modal.classList.remove("hidden");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btnSubmit.disabled = true;
    const formData = new FormData(form);
    const json = {};
    formData.forEach((v, k) => json[k] = v);

    const response = await fetch("https://script.google.com/macros/s/AKfycbwxV7XSToS9PpyeESpA2qP1StyhGQiY2Pdlz8yYITjM50KeogrIacQgHaQiubdjNskN/exec", {
      method: "POST",
      body: JSON.stringify(json),
      headers: { "Content-Type": "application/json" }
    });

    const result = await response.json();
    if (result.success) {
      alert("✅ Registro exitoso");
      form.reset();
    } else if (result.error === "token_expired") {
      modal.classList.remove("hidden");
    } else {
      alert("❌ Ocurrió un error.");
    }
    btnSubmit.disabled = false;
  });
});
