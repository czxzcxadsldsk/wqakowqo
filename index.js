const { jsPDF } = window.jspdf;

/* =========================================================
   CONFIGURACIÓN DE LA NUMERACIÓN AUTOMÁTICA
   ---------------------------------------------------------
   El número se guarda solo en la memoria del navegador
   (localStorage) y sube +1 cada vez que se genera un PDF.
   ========================================================= */

// Clave con la que se guarda el último número emitido.
const CLAVE_STORAGE = "facturacion:ultimaCotizacion";

// ULTIMO NUMERO EMITIDO A MANO (antes de que esto fuera automático).
// Solo se usa la PRIMERA vez que se abre la página en una compu nueva:
// a partir de ahí manda lo que quedo guardado en el navegador.
// El AÑO de acá abajo NO es el que se muestra: el año siempre sale del
// calendario de la compu, así que en 2026 el campo dice 2026-0853,
// en 2027 va a decir 2027-xxxx, y así. Solo tocá "secuencia" si él ya
// viene usando un número más alto que 852.
const SEMILLA = { anio: 2025, secuencia: 852 };

// Cantidad de dígitos del número: 4 => 0853, 5 => 00853
const DIGITOS = 4;

// Rango del botón "Número al azar" (solo se usa con ese botón).
const AZAR_MIN = 1000;
const AZAR_MAX = 9999;

// true  => cada 1 de enero vuelve a 0001 (ej: 2027-0001)
// false => la numeración sigue de largo y solo cambia el año
const REINICIAR_POR_ANIO = false;

/* ========================================================= */

// Variables globales
let products = [];      // Array para almacenar los productos
let proximoId = 1;      // Contador de IDs (no se reutiliza al borrar filas)

// Referencias a elementos del DOM
const productInput = document.getElementById("product");
const quantityInput = document.getElementById("quantity");
const priceInput = document.getElementById("price");
const invoiceBody = document.getElementById("invoiceBody");
const totalProfit = document.getElementById("totalProfit");
const quotationNumberInput = document.getElementById("quotationNumber");
const quotationDateInput = document.getElementById("quotationDate");
const contactInput = document.getElementById("contact");
const lastIssuedHint = document.getElementById("lastIssuedHint");

/* ---------------------------------------------------------
   NUMERACIÓN
   --------------------------------------------------------- */

// { anio: 2025, secuencia: 853 }  ->  "2025-0853"
function formatearNumero({ anio, secuencia }) {
    return `${anio}-${String(secuencia).padStart(DIGITOS, "0")}`;
}

// "2025-0853"  ->  { anio: 2025, secuencia: 853 }   (null si está mal escrito)
function parsearNumero(texto) {
    const match = String(texto || "").trim().match(/^(\d{4})-(\d+)$/);
    if (!match) return null;
    return { anio: Number(match[1]), secuencia: Number(match[2]) };
}

// Sirve para comparar dos números y saber cuál es más nuevo.
function peso({ anio, secuencia }) {
    return anio * 1000000 + secuencia;
}

// Lee de la memoria del navegador el último número que se emitió.
function leerUltimaEmitida() {
    try {
        const crudo = localStorage.getItem(CLAVE_STORAGE);
        if (!crudo) return null;
        const dato = JSON.parse(crudo);
        if (!Number.isInteger(dato.anio) || !Number.isInteger(dato.secuencia)) return null;
        return dato;
    } catch (error) {
        console.warn("No se pudo leer el último número guardado:", error);
        return null;
    }
}

// Guarda el número recién usado, con la fecha en que se usó.
function guardarUltimaEmitida(numero) {
    try {
        localStorage.setItem(CLAVE_STORAGE, JSON.stringify({
            anio: numero.anio,
            secuencia: numero.secuencia,
            emitidaEl: new Date().toISOString()
        }));
        return true;
    } catch (error) {
        console.warn("No se pudo guardar el número de cotización:", error);
        alert("Ojo: el navegador no dejó guardar el número de cotización.\n" +
              "Anotá el número usado, porque la próxima vez puede repetirse.");
        return false;
    }
}

// Calcula cuál es el próximo número libre.
function calcularProximoNumero() {
    const anioActual = new Date().getFullYear();
    const ultima = leerUltimaEmitida() || SEMILLA;

    if (REINICIAR_POR_ANIO && ultima.anio < anioActual) {
        return { anio: anioActual, secuencia: 1 };
    }

    return {
        anio: Math.max(anioActual, ultima.anio),
        secuencia: ultima.secuencia + 1
    };
}

// Texto de ayuda debajo del campo del número.
function actualizarAviso() {
    const ultima = leerUltimaEmitida();
    if (!ultima) {
        lastIssuedHint.textContent =
            `Primera cotización desde esta computadora: arranca en ` +
            `${formatearNumero(calcularProximoNumero())} y de ahí sube sola.`;
        return;
    }
    const fecha = ultima.emitidaEl ? new Date(ultima.emitidaEl) : null;
    const cuando = fecha && !isNaN(fecha)
        ? ` (${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${fecha.getFullYear()})`
        : "";
    lastIssuedHint.textContent = `Última cotización emitida: ${formatearNumero(ultima)}${cuando}`;
}

// Deja el campo listo con el próximo número.
function cargarProximoNumero() {
    quotationNumberInput.value = formatearNumero(calcularProximoNumero());
    quotationNumberInput.readOnly = true;
    actualizarAviso();
}

// Botón "Corregir a mano": desbloquea el campo por si hay que pisar el número.
document.getElementById("editNumberButton").addEventListener("click", () => {
    quotationNumberInput.readOnly = !quotationNumberInput.readOnly;
    if (!quotationNumberInput.readOnly) {
        quotationNumberInput.focus();
        quotationNumberInput.select();
    }
});

// Botón "Recalcular": vuelve al número que corresponde según lo guardado.
document.getElementById("resetNumberButton").addEventListener("click", cargarProximoNumero);

// Tira un número al azar, para cuando no se sabe por dónde iba la numeración
// (compu nueva, se borró la memoria del navegador, etc).
// Nunca devuelve uno igual o anterior al último emitido, así no se repite.
function numeroAlAzar() {
    const anioActual = new Date().getFullYear();
    const ultima = leerUltimaEmitida();
    const anio = Math.max(anioActual, ultima ? ultima.anio : anioActual);

    // El piso es el número siguiente al último emitido de este año.
    const piso = (ultima && ultima.anio === anio)
        ? Math.max(AZAR_MIN, ultima.secuencia + 1)
        : AZAR_MIN;
    const techo = Math.max(piso, AZAR_MAX);

    const secuencia = piso + Math.floor(Math.random() * (techo - piso + 1));
    return { anio, secuencia };
}

// Botón "Número al azar".
document.getElementById("randomNumberButton").addEventListener("click", () => {
    const numero = numeroAlAzar();
    quotationNumberInput.value = formatearNumero(numero);
    quotationNumberInput.readOnly = true;
    lastIssuedHint.textContent =
        `Número al azar. Todavía no se emitió: se guarda recién cuando generás el PDF. ` +
        `("Recalcular" lo deshace.)`;
});

/* ---------------------------------------------------------
   FECHA
   --------------------------------------------------------- */

// Fecha de hoy en formato YYYY-MM-DD (hora local, sin correrse de día).
function hoyISO() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

// "2026-09-17" -> "17/09/2026"
function fechaParaPDF(valorISO) {
    const match = String(valorISO || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return hoyISO().split("-").reverse().join("/");
    return `${match[3]}/${match[2]}/${match[1]}`;
}

/* ---------------------------------------------------------
   PRODUCTOS
   --------------------------------------------------------- */

// Función para agregar un producto a la lista
document.getElementById("addButton").addEventListener("click", () => {
    const product = productInput.value.trim();
    const quantity = parseInt(quantityInput.value);
    const price = parseFloat(priceInput.value);

    if (!product || isNaN(quantity) || isNaN(price) || quantity <= 0 || price <= 0) {
        alert("Por favor, ingrese valores válidos.");
        return;
    }

    const total = quantity * price;
    const productId = proximoId++; // ID único para cada producto

    products.push({ id: productId, product, quantity, price, total });

    // Actualizar la tabla
    addProductRow({ id: productId, product, quantity, price, total });

    // Actualizar la ganancia total
    updateTotalProfit();

    // Limpiar los campos de entrada
    productInput.value = "";
    quantityInput.value = "";
    priceInput.value = "";
    productInput.focus();
});

// Función para actualizar la ganancia total
function updateTotalProfit() {
    const total = products.reduce((sum, item) => sum + item.total, 0);
    totalProfit.textContent = total.toLocaleString("es-AR", { minimumFractionDigits: 2 });
}

// Función para agregar una fila en la tabla
function addProductRow({ id, product, quantity, price, total }) {
    const row = document.createElement("tr");
    row.dataset.id = id;
    row.innerHTML = `
        <td>${product}</td>
        <td>${quantity.toLocaleString("es-AR")}</td>
        <td>$${price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
        <td>$${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
        <td>
            <button class="editButton">Editar</button>
            <button class="deleteButton">Eliminar</button>
        </td>
    `;
    invoiceBody.appendChild(row);

    // Agregar eventos a los botones de la fila
    row.querySelector(".editButton").addEventListener("click", () => editProduct(id));
    row.querySelector(".deleteButton").addEventListener("click", () => deleteProduct(id));
}

// Función para editar un producto
function editProduct(id) {
    const product = products.find((item) => item.id === id);
    if (!product) return;

    // Rellenar los campos de entrada con los valores existentes
    productInput.value = product.product;
    quantityInput.value = product.quantity;
    priceInput.value = product.price;

    // Eliminar el producto actual antes de editarlo
    deleteProduct(id);
}

// Función para eliminar un producto
function deleteProduct(id) {
    products = products.filter((item) => item.id !== id);

    // Eliminar la fila de la tabla
    const row = invoiceBody.querySelector(`tr[data-id="${id}"]`);
    if (row) row.remove();

    // Actualizar la ganancia total
    updateTotalProfit();
}

// Botón "Nueva cotización": vacía la lista para empezar de cero.
document.getElementById("newQuotationButton").addEventListener("click", () => {
    if (products.length > 0 && !confirm("¿Vaciar la lista y empezar una cotización nueva?")) return;
    products = [];
    invoiceBody.innerHTML = "";
    contactInput.value = "";
    productInput.value = "";
    quantityInput.value = "";
    priceInput.value = "";
    updateTotalProfit();
    quotationDateInput.value = hoyISO();
    cargarProximoNumero();
});

/* ---------------------------------------------------------
   PDF
   --------------------------------------------------------- */

document.getElementById("generatePDF").addEventListener("click", () => {
    if (products.length === 0) {
        alert("No hay productos en la factura.");
        return;
    }

    const contact = contactInput.value.trim();
    if (!contact) {
        alert("Por favor, ingrese el contacto del cliente.");
        return;
    }

    // Validar el número de cotización
    const numero = parsearNumero(quotationNumberInput.value);
    if (!numero) {
        alert("El número de cotización tiene que tener el formato AÑO-NÚMERO, por ejemplo 2026-0853.");
        quotationNumberInput.focus();
        return;
    }

    // Avisar si ese número ya se usó (esto es lo que evita repetir)
    const ultima = leerUltimaEmitida();
    if (ultima && peso(numero) <= peso(ultima)) {
        const seguir = confirm(
            `El número ${formatearNumero(numero)} es igual o anterior al último emitido ` +
            `(${formatearNumero(ultima)}).\n\n¿Querés generar el PDF igual?`
        );
        if (!seguir) return;
    }

    const quotationNumber = formatearNumero(numero);
    const date = fechaParaPDF(quotationDateInput.value);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20; // Posición inicial vertical

    // Encabezado
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Julio Escalada", pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setFontSize(12);
    doc.setFont("Helvetica", "normal");
    doc.text("Reparación y Mantenimiento de Máquinas Industriales", pageWidth / 2, y, { align: "center" });
    y += 10;

    // Línea divisoria
    doc.setLineWidth(0.5);
    doc.line(10, y, pageWidth - 10, y);
    y += 10;

    // Información del cliente y fecha
    doc.setFont("Helvetica", "bold");
    doc.text("Cliente", 10, y);
    doc.setFont("Helvetica", "normal");
    y += 6;
    doc.text("Contacto:", 10, y);
    doc.text(contact, 30, y); // Nombre del contacto
    y += 6;
    doc.text(`Fecha: ${date}`, 10, y); // Fecha justo debajo del contacto

    // Cotización
    doc.setFont("Helvetica", "bold");
    doc.text(`Cotización Nº ${quotationNumber}`, pageWidth - 10, y + 12, { align: "right" });
    y += 24;

    // Tabla
    doc.autoTable({
        head: [["Item", "Cant.", "Descripción", "Precio Unitario", "Precio Total"]],
        body: products.map((item, index) => [
            index + 1,
            item.quantity.toLocaleString("es-AR"),
            item.product,
            `$${item.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`,
            `$${item.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
        ]),
        startY: y,
        theme: "grid",
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
        margin: { left: 10, right: 10 },
    });

    // Total final
    y = doc.lastAutoTable.finalY + 10;
    doc.setFont("Helvetica", "bold");
    doc.text(`Total: $${totalProfit.textContent}`, pageWidth - 10, y, { align: "right" });

    // Pie de página
    y += 20;
    doc.setFont("Helvetica", "normal");
    doc.text("Una entrega de 20 días hábiles a partir de la confirmación", 10, y);
    doc.text("Los precios no incluyen IVA.", 10, y + 6);
    doc.text("Validez 7 días.", 10, y + 12);
    doc.text("Cotizó: Julio Escalada", 10, y + 18);

    // Guardar el PDF con el número en el nombre del archivo
    doc.save(`Cotizacion-${quotationNumber}.pdf`);

    // Recién ahora se "quema" el número: se guarda y el campo pasa al siguiente
    guardarUltimaEmitida(numero);
    cargarProximoNumero();
});

/* ---------------------------------------------------------
   ARRANQUE
   --------------------------------------------------------- */

quotationDateInput.value = hoyISO();
cargarProximoNumero();
