const { jsPDF } = window.jspdf;

// Variables globales
let products = []; // Array para almacenar los productos

// Referencias a elementos del DOM
const productInput = document.getElementById("product");
const quantityInput = document.getElementById("quantity");
const priceInput = document.getElementById("price");
const invoiceBody = document.getElementById("invoiceBody");
const totalProfit = document.getElementById("totalProfit");
const quotationNumberInput = document.getElementById("quotationNumber");
const contactInput = document.getElementById("contact");

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
    const productId = products.length + 1; // ID único para cada producto

    products.push({ id: productId, product, quantity, price, total });

    // Actualizar la tabla
    addProductRow({ id: productId, product, quantity, price, total });

    // Actualizar la ganancia total
    updateTotalProfit();

    // Limpiar los campos de entrada
    productInput.value = "";
    quantityInput.value = "";
    priceInput.value = "";
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

// Función para generar el PDF
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

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20; // Posición inicial vertical

    const quotationNumber = quotationNumberInput.value.trim();

    // Obtener la fecha actual
    const today = new Date();
    const date = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

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
    doc.text(`Fecha: ${date}`, 10, y); // Fecha justo debajo del contacto y es para que se mueva los numeros justo donde se quiere imprimir

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

    // Guardar el PDF
    doc.save("cotizacion.pdf");
});
