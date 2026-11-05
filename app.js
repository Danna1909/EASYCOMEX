
"use strict";

// CONFIGURACIÓN
// Coloca aquí el correo real de los asesores.
const ASESOR_EMAIL = "";

const $ = id => document.getElementById(id);

function getData(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
}

function saveData(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        notify("No hay espacio suficiente para guardar los datos.");
    }
}

function notify(message) {
    $("toast").textContent = message;
    $("toast").style.display = "block";
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        $("toast").style.display = "none";
    }, 3000);
}

function safe(text) {
    return String(text ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;"
    })[char]);
}

function money(value) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0
    }).format(value || 0);
}

// NAVEGACIÓN
function showPage(page) {
    document.querySelectorAll(".section").forEach(section => {
        section.classList.toggle("active", section.id === page);
    });

    document.querySelectorAll(".nav button").forEach(button => {
        button.classList.toggle("active", button.dataset.page === page);
    });

    const names = {
        inicio: "Inicio",
        calculadora: "Calculadora de costos",
        documentos: "Documentos",
        proveedores: "Proveedores",
        usuario: "Mi usuario",
        publicaciones: "Publicaciones",
        tributaria: "Infórmate",
        ayuda: "Ayuda y asesores"
    };

    $("crumb").textContent = names[page] || "Inicio";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav button").forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.page));
});

// CALCULADORA
function calculate() {
    const value = id => Number($(id).value) || 0;

    const fob = value("fob");
    const seguro = value("seguro");
    const flete = value("flete");
    const otros = value("otros");
    const trm = value("trm");
    const porcentaje = value("arancel");

    const cifUsd = fob + seguro + flete + otros;
    const cifCop = cifUsd * trm;
    const arancel = cifCop * porcentaje / 100;
    const baseIva = cifCop + arancel;
    const iva = baseIva * 0.19;
    const tributos = arancel + iva;
    const total = cifCop + tributos;

    $("r-cif-usd").textContent =
        "US$ " + cifUsd.toFixed(2);

    $("r-cif-cop").textContent = money(cifCop);
    $("r-arancel").textContent = money(arancel);
    $("r-base").textContent = money(baseIva);
    $("r-iva").textContent = money(iva);
    $("r-tributos").textContent = money(tributos);
    $("r-total").textContent = money(total);

    saveData("easycomex_last_cif", cifCop);
    updateStats();
}

$("calc-form").addEventListener("submit", event => {
    event.preventDefault();

    if (!event.target.reportValidity()) return;

    calculate();
    notify("Cálculo realizado correctamente.");
});

$("calc-form").addEventListener("reset", () => {
    setTimeout(calculate, 0);
});

["fob", "seguro", "flete", "otros", "trm", "arancel"]
    .forEach(id => $(id).addEventListener("input", calculate));

// DOCUMENTOS
const documents = [
    "Factura comercial",
    "Lista de empaque (Packing List)",
    "Documento de transporte",
    "Soportes de flete y seguro",
    "SWIFT de transferencia",
    "Consulta de inventario"
];

let docState = getData("easycomex_docs", {});
let docFiles = {};

function renderDocs() {
    $("doc-list").innerHTML = documents.map((name, index) => `
        <div class="doc-item">
            <div class="doc-info">
                <strong>${safe(name)}</strong>
                <p>${docFiles[index] || (docState[index] ? "Preparado" : "Pendiente")}</p>
            </div>
            <label>
                <input type="checkbox" data-check="${index}"
                    ${docState[index] ? "checked" : ""}>
                Listo
            </label>
            <input type="file" data-file="${index}">
        </div>
    `).join("");

    document.querySelectorAll("[data-check]").forEach(input => {
        input.addEventListener("change", () => {
            docState[input.dataset.check] = input.checked;
            saveData("easycomex_docs", docState);
            renderDocs();
            updateStats();
        });
    });

    document.querySelectorAll("[data-file]").forEach(input => {
        input.addEventListener("change", () => {
            if (input.files[0]) {
                docFiles[input.dataset.file] = input.files[0].name;
                renderDocs();
                notify("Archivo seleccionado.");
            }
        });
    });

    const ready = documents.filter((_, i) => docState[i]).length;
    $("doc-progress").textContent =
        `${ready} de ${documents.length} documentos listos`;
}

// PROVEEDORES
let suppliers = getData("easycomex_suppliers", []);

function renderSuppliers() {
    const query = $("supplier-search").value.toLowerCase();

    const filtered = suppliers.filter(supplier =>
        [
            supplier.empresa,
            supplier.pais,
            supplier.ciudad,
            supplier.correo
        ].some(value => (value || "").toLowerCase().includes(query))
    );

    $("supplier-table").innerHTML = filtered.length
        ? filtered.map(supplier => `
            <tr>
                <td><strong>${safe(supplier.empresa)}</strong><br>
                    ${safe(supplier.direccion)}</td>
                <td>${safe(supplier.pais)}<br>
                    ${safe(supplier.ciudad)}</td>
                <td>${safe(supplier.telefono)}<br>
                    ${safe(supplier.correo)}</td>
                <td><button class="btn btn-light"
                    onclick="editSupplier('${supplier.id}')">Editar</button>
                    <button class="btn btn-light"
                    onclick="deleteSupplier('${supplier.id}')">Eliminar</button>
                </td>
            </tr>
        `).join("")
        : `<tr><td colspan="4">No hay proveedores registrados.</td></tr>`;

    updateStats();
}

$("supplier-form").addEventListener("submit", event => {
    event.preventDefault();

    const id = $("supplier-id").value;

    const supplier = {
        id: id || String(Date.now()),
        empresa: $("empresa").value.trim(),
        pais: $("pais").value.trim(),
        ciudad: $("ciudad").value.trim(),
        direccion: $("direccion").value.trim(),
        telefono: $("telefono").value.trim(),
        correo: $("correo").value.trim()
    };

    if (id) {
        suppliers = suppliers.map(item =>
            item.id === id ? supplier : item
        );
    } else {
        suppliers.push(supplier);
    }

    saveData("easycomex_suppliers", suppliers);
    renderSuppliers();
    $("supplier-form").reset();
    $("supplier-id").value = "";

    notify("Proveedor guardado correctamente.");
});

function editSupplier(id) {
    const supplier = suppliers.find(item => item.id === id);
    if (!supplier) return;

    $("supplier-id").value = supplier.id;
    $("empresa").value = supplier.empresa;
    $("pais").value = supplier.pais;
    $("ciudad").value = supplier.ciudad;
    $("direccion").value = supplier.direccion;
    $("telefono").value = supplier.telefono;
    $("correo").value = supplier.correo;

    showPage("proveedores");
    $("supplier-form").scrollIntoView({ behavior: "smooth" });
}

function deleteSupplier(id) {
    if (!confirm("¿Deseas eliminar este proveedor?")) return;

    suppliers = suppliers.filter(item => item.id !== id);
    saveData("easycomex_suppliers", suppliers);
    renderSuppliers();
    notify("Proveedor eliminado.");
}

$("supplier-search").addEventListener("input", renderSuppliers);

// INVENTARIO
let inventory = getData("easycomex_inventory", []);

function renderInventory() {
    $("inv-table").innerHTML = inventory.length
        ? inventory.map((item, index) => `
            <tr>
                <td>${safe(item.ref)}</td>
                <td>${safe(item.qty)}</td>
                <td>${safe(item.notes || "—")}</td>
                <td><button class="btn btn-light"
                    onclick="deleteInventory(${index})">Eliminar</button></td>
            </tr>
        `).join("")
        : `<tr><td colspan="4">No hay productos registrados.</td></tr>`;
}

$("inventory-form").addEventListener("submit", event => {
    event.preventDefault();

    const ref = $("inv-ref").value.trim();
    const qty = $("inv-cantidad").value;
    const notes = $("inv-notas").value.trim();

    if (!ref || qty === "" || Number(qty) < 0) {
        notify("Ingresa una cantidad válida.");
        return;
    }

    inventory.push({ ref, qty, notes });
    saveData("easycomex_inventory", inventory);
    renderInventory();
    event.target.reset();
    notify("Producto agregado al inventario.");
});

function deleteInventory(index) {
    inventory.splice(index, 1);
    saveData("easycomex_inventory", inventory);
    renderInventory();
}

// PERFIL DE USUARIO
let userProfile = getData("easycomex_user_profile", {});

function loadUser() {
    $("user-name").value = userProfile.name || "";
    $("user-email").value = userProfile.email || "";
    $("user-company").value = userProfile.company || "";
    $("user-role").value = userProfile.role || "Cliente / Importador";
    updateUserHeader();
}

function updateUserHeader() {
    const name = userProfile.name || "Mi cuenta";
    $("top-user-name").textContent = name;

    $("top-avatar").textContent = name === "Mi cuenta"
        ? "EC"
        : name.trim().split(/\s+/).slice(0, 2)
            .map(part => part[0]).join("").toUpperCase();
}

$("user-form").addEventListener("submit", event => {
    event.preventDefault();

    userProfile = {
        name: $("user-name").value.trim(),
        email: $("user-email").value.trim(),
        company: $("user-company").value.trim(),
        role: $("user-role").value
    };

    saveData("easycomex_user_profile", userProfile);
    updateUserHeader();
    notify("Perfil guardado correctamente.");
});

loadUser();

// PUBLICACIONES DE PROVEEDORES
let posts = getData("easycomex_posts", []);

function renderPosts() {
    $("posts-list").innerHTML = posts.length
        ? posts.map(post => `
            <article class="product-card">
                ${post.image
                    ? `<img src="${post.image}" alt="Producto">`
                    : "<div>📦 Producto</div>"}
                <h3>${safe(post.product)}</h3>
                <div class="product-price">US$ ${Number(post.price).toFixed(2)}</div>
                <p>Proveedor: ${safe(post.supplier)}</p>
                <p>País: ${safe(post.country)}</p>
                <p>${safe(post.description)}</p>
                <p>Contacto: ${safe(post.email)}</p>
                <button class="btn btn-light"
                    onclick="deletePost('${post.id}')">Eliminar publicación</button>
            </article>
        `).join("")
        : `<p class="hint">Todavía no hay productos publicados.</p>`;
}

$("post-form").addEventListener("submit", event => {
    event.preventDefault();

    const file = $("post-image").files[0];

    const post = {
        id: String(Date.now()),
        product: $("post-product").value.trim(),
        supplier: $("post-supplier").value.trim(),
        country: $("post-country").value.trim(),
        price: Number($("post-price").value),
        email: $("post-email").value.trim(),
        description: $("post-description").value.trim(),
        image: ""
    };

    function savePost() {
        posts.unshift(post);

        try {
            localStorage.setItem("easycomex_posts", JSON.stringify(posts));
            renderPosts();
            event.target.reset();
            notify("Publicación guardada correctamente.");
        } catch {
            posts.shift();
            notify("No hay espacio suficiente para guardar la imagen.");
        }
    }

    if (!file) {
        savePost();
        return;
    }

    if (!file.type.startsWith("image/") || file.size > 1024 * 1024) {
        notify("Selecciona una imagen válida de máximo 1 MB.");
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {
        post.image = reader.result;
        savePost();
    };

    reader.onerror = () => notify("No se pudo leer la imagen.");
    reader.readAsDataURL(file);
});

function deletePost(id) {
    if (!confirm("¿Eliminar esta publicación?")) return;

    posts = posts.filter(post => post.id !== id);
    saveData("easycomex_posts", posts);
    renderPosts();
    notify("Publicación eliminada.");
}

renderPosts();

// AYUDA Y ASESORES
$("help-form").addEventListener("submit", event => {
    event.preventDefault();

    if (!ASESOR_EMAIL) {
        notify("Configura el correo del asesor en app.js.");
        return;
    }

    const name = $("help-name").value.trim();
    const email = $("help-email").value.trim();
    const topic = $("help-topic").value;
    const message = $("help-message").value.trim();

    const subject = encodeURIComponent("Consulta EASYCOMEX: " + topic);

    const body = encodeURIComponent(
        "Nombre: " + name +
        "\nCorreo: " + email +
        "\nTema: " + topic +
        "\n\nConsulta:\n" + message
    );

    window.location.href =
        "mailto:" + ASESOR_EMAIL +
        "?subject=" + subject +
        "&body=" + body;

    notify("Se abrió tu aplicación de correo.");
});

// ACTUALIZAR PANEL PRINCIPAL
function updateStats() {
    $("stat-proveedores").textContent = suppliers.length;
    $("stat-documentos").textContent = documents.length;
    $("stat-cif").textContent =
        money(getData("easycomex_last_cif", 0));
}

// INICIAR APLICACIÓN
calculate();
renderDocs();
renderSuppliers();
renderInventory();
renderPosts();
updateStats();

