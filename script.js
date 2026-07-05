// Global State
let uploadedFile = null; 
let originalFileName = "";
let totalPages = 0;
let currentTool = 'text'; // 'text' or 'sign'
let savedSignatureBase64 = null; // Stores the user's drawn signature

// Toolbar States
let currentFont = 'Helvetica';
let isBold = false;
let isItalic = false;

// UI Elements
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const chooseBtn = document.getElementById('choose-btn');
const pagesContainer = document.getElementById('pages-container');
const editorToolbar = document.getElementById('editor-toolbar');
const modal = document.getElementById('processing-modal');
const downloadBtn = document.getElementById('download-btn');

// Toolbar Elements
const toolTextBtn = document.getElementById('tool-text');
const toolSignBtn = document.getElementById('tool-sign');
const btnCreateSign = document.getElementById('btn-create-sign');
const fontSelect = document.getElementById('font-family');
const btnBold = document.getElementById('btn-bold');
const btnItalic = document.getElementById('btn-italic');
const fontSizeInput = document.getElementById('font-size');
const colorInput = document.getElementById('text-color');

// Signature Modal Elements
const sigModal = document.getElementById('signature-modal');
const sigCanvas = document.getElementById('signature-pad');
const sigCtx = sigCanvas.getContext('2d');
const btnClearSig = document.getElementById('clear-signature');
const btnSaveSig = document.getElementById('save-signature');
const btnCancelSig = document.getElementById('cancel-signature');

// --- Tool Selector Logic ---
toolTextBtn.addEventListener('click', () => {
    currentTool = 'text';
    toolTextBtn.classList.add('active');
    toolSignBtn.classList.remove('active');
});

toolSignBtn.addEventListener('click', () => {
    currentTool = 'sign';
    toolSignBtn.classList.add('active');
    toolTextBtn.classList.remove('active');
    if (!savedSignatureBase64) {
        openSignaturePad();
    }
});

// --- Rich Text Styling Logic ---
fontSelect.addEventListener('change', (e) => { currentFont = e.target.value; });
btnBold.addEventListener('click', () => { isBold = !isBold; btnBold.classList.toggle('active'); });
btnItalic.addEventListener('click', () => { isItalic = !isItalic; btnItalic.classList.toggle('active'); });

// --- Signature Drawing Logic ---
let isDrawing = false;
btnCreateSign.addEventListener('click', openSignaturePad);

function openSignaturePad() {
    sigModal.style.display = 'flex';
    clearSignature();
}

sigCanvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    sigCtx.beginPath();
    sigCtx.moveTo(e.offsetX, e.offsetY);
});
sigCanvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
        sigCtx.lineTo(e.offsetX, e.offsetY);
        sigCtx.stroke();
    }
});
sigCanvas.addEventListener('mouseup', () => { isDrawing = false; });
sigCanvas.addEventListener('mouseout', () => { isDrawing = false; });

// Touch support for signature
sigCanvas.addEventListener('touchstart', (e) => {
    isDrawing = true;
    const touch = e.touches[0];
    const rect = sigCanvas.getBoundingClientRect();
    sigCtx.beginPath();
    sigCtx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    e.preventDefault();
});
sigCanvas.addEventListener('touchmove', (e) => {
    if (isDrawing) {
        const touch = e.touches[0];
        const rect = sigCanvas.getBoundingClientRect();
        sigCtx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
        sigCtx.stroke();
    }
    e.preventDefault();
});
sigCanvas.addEventListener('touchend', () => { isDrawing = false; });

btnClearSig.addEventListener('click', clearSignature);
function clearSignature() {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
}

btnCancelSig.addEventListener('click', () => { sigModal.style.display = 'none'; });

btnSaveSig.addEventListener('click', () => {
    savedSignatureBase64 = sigCanvas.toDataURL("image/png");
    sigModal.style.display = 'none';
    
    // Auto-switch to sign tool
    currentTool = 'sign';
    toolSignBtn.classList.add('active');
    toolTextBtn.classList.remove('active');
    btnCreateSign.innerHTML = '✏️ Update Signature';
});

// --- Helper: Download Function ---
function download(data, filename, type) {
    const blob = new Blob([data], { type: type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- Uploading Logic ---
chooseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) processFile(e.target.files[0]);
    fileInput.value = ''; 
});

// --- Process File & Render ---
async function processFile(file) {
    if (file.type !== 'application/pdf') {
        alert("Please select a valid PDF file.");
        return;
    }

    modal.style.display = 'flex';
    uploadedFile = file;
    originalFileName = file.name.replace('.pdf', '');

    try {
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        totalPages = pdfDoc.getPageCount();

        await buildPageEditors();
        editorToolbar.style.display = 'block';

    } catch (error) {
        console.error("Error reading PDF:", error);
        alert("Could not process this PDF.");
    }
    
    modal.style.display = 'none';
}

async function buildPageEditors() {
    pagesContainer.innerHTML = '';

    const previewBuffer = await uploadedFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(previewBuffer) });
    const pdfViewerDoc = await loadingTask.promise;

    for (let i = 0; i < totalPages; i++) {
        const card = document.createElement('div');
        card.className = 'page-container';
        
        card.innerHTML = `
            <div class="page-title">Page ${i + 1}</div>
            <div class="canvas-wrapper" id="wrapper-${i}">
                <canvas id="canvas-${i}" class="pdf-canvas"></canvas>
            </div>
        `;
        
        pagesContainer.appendChild(card);

        try {
            const page = await pdfViewerDoc.getPage(i + 1);
            const canvas = document.getElementById(`canvas-${i}`);
            const context = canvas.getContext('2d');
            
            const unscaledViewport = page.getViewport({ scale: 1 });
            const scale = 1000 / unscaledViewport.height; // Large for readability
            const viewport = page.getViewport({ scale: scale });
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const wrapper = document.getElementById(`wrapper-${i}`);
            wrapper.addEventListener('mousedown', (e) => handleCanvasClick(e, wrapper));

        } catch (err) {
            console.error("Error rendering preview", err);
        }
    }
}

// --- Spawn Text & Signature Elements ---
function handleCanvasClick(e, wrapper) {
    if (e.target !== wrapper && e.target.tagName !== 'CANVAS') return;

    if (currentTool === 'sign' && !savedSignatureBase64) {
        alert("Please create a signature first!");
        openSignaturePad();
        return;
    }

    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const elementContainer = document.createElement('div');
    elementContainer.className = 'overlay-element';
    
    if (currentTool === 'text') {
        elementContainer.style.left = `${x}px`;
        elementContainer.style.top = `${y - 15}px`; 
    } else {
        // Center signature somewhat on click
        elementContainer.style.left = `${x - 100}px`;
        elementContainer.style.top = `${y - 50}px`;
    }

    // --- Create Drag Handle ---
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '⋮⋮ Drag';
    
    dragHandle.addEventListener('mousedown', function(e) {
        e.preventDefault(); 
        
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseFloat(elementContainer.style.left) || 0;
        const startTop = parseFloat(elementContainer.style.top) || 0;

        function doDrag(e) {
            elementContainer.style.left = `${startLeft + e.clientX - startX}px`;
            elementContainer.style.top = `${startTop + e.clientY - startY}px`;
        }

        function stopDrag() {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        }

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    });

    elementContainer.appendChild(dragHandle);

    // --- Create Delete Button ---
    const deleteBtn = document.createElement('button');
    deleteBtn.innerText = 'X';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = () => wrapper.removeChild(elementContainer);
    elementContainer.appendChild(deleteBtn);

    // --- Populate the tool ---
    if (currentTool === 'text') {
        const textarea = document.createElement('textarea');
        textarea.className = 'text-overlay';
        
        textarea.style.fontFamily = currentFont === 'TimesRoman' ? '"Times New Roman", Times, serif' : 
                                    currentFont === 'Courier' ? '"Courier New", Courier, monospace' : 
                                    'Helvetica, Arial, sans-serif';
        
        textarea.style.fontSize = `${fontSizeInput.value}px`;
        textarea.style.color = colorInput.value;
        textarea.style.fontWeight = isBold ? 'bold' : 'normal';
        textarea.style.fontStyle = isItalic ? 'italic' : 'normal';
        
        textarea.dataset.fontFamily = currentFont;
        textarea.dataset.isBold = isBold;
        textarea.dataset.isItalic = isItalic;

        textarea.placeholder = "Type here...";
        elementContainer.appendChild(textarea);
        wrapper.appendChild(elementContainer);
        textarea.focus();
    } 
    else if (currentTool === 'sign') {
        const signBox = document.createElement('div');
        signBox.className = 'signature-overlay';
        
        const img = document.createElement('img');
        img.src = savedSignatureBase64;
        
        // Store the base64 internally to extract later
        signBox.dataset.imgSrc = savedSignatureBase64;
        
        signBox.appendChild(img);
        elementContainer.appendChild(signBox);
        wrapper.appendChild(elementContainer);
    }
}

// --- Helper: Map Styles to PDF-Lib Standard Fonts ---
function getPdfFont(pdfDoc, PDFLib, fontFamily, isBold, isItalic) {
    const { StandardFonts } = PDFLib;
    let fontEnum = StandardFonts.Helvetica;

    if (fontFamily === 'Helvetica') {
        if (isBold && isItalic) fontEnum = StandardFonts.HelveticaBoldOblique;
        else if (isBold) fontEnum = StandardFonts.HelveticaBold;
        else if (isItalic) fontEnum = StandardFonts.HelveticaOblique;
    } 
    else if (fontFamily === 'TimesRoman') {
        if (isBold && isItalic) fontEnum = StandardFonts.TimesRomanBoldItalic;
        else if (isBold) fontEnum = StandardFonts.TimesRomanBold;
        else if (isItalic) fontEnum = StandardFonts.TimesRomanItalic;
        else fontEnum = StandardFonts.TimesRoman;
    } 
    else if (fontFamily === 'Courier') {
        if (isBold && isItalic) fontEnum = StandardFonts.CourierBoldOblique;
        else if (isBold) fontEnum = StandardFonts.CourierBold;
        else if (isItalic) fontEnum = StandardFonts.CourierOblique;
        else fontEnum = StandardFonts.Courier;
    }

    return pdfDoc.embedFont(fontEnum);
}

// --- Process and Download Edited PDF ---
downloadBtn.addEventListener('click', async () => {
    if (!uploadedFile) return;
    modal.style.display = 'flex';

    try {
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const { PDFDocument, rgb } = PDFLib;
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();
        
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const pdfWidth = page.getWidth();
            const pdfHeight = page.getHeight();
            
            const wrapper = document.getElementById(`wrapper-${i}`);
            const canvas = document.getElementById(`canvas-${i}`);
            const overlays = wrapper.querySelectorAll('.overlay-element');
            
            for (const overlay of overlays) {
                const domX = parseFloat(overlay.style.left);
                const domY = parseFloat(overlay.style.top);
                const domWidth = overlay.offsetWidth;
                const domHeight = overlay.offsetHeight;

                const scaleX = pdfWidth / canvas.offsetWidth;
                const scaleY = pdfHeight / canvas.offsetHeight;

                const pdfX = domX * scaleX;
                const pdfY = pdfHeight - (domY * scaleY) - (domHeight * scaleY);
                const finalPdfWidth = domWidth * scaleX;
                const finalPdfHeight = domHeight * scaleY;

                // 1. Process Signature Boxes
                const signBox = overlay.querySelector('.signature-overlay');
                if (signBox) {
                    const imgSrc = signBox.dataset.imgSrc;
                    // convert base64 to Uint8Array
                    const res = await fetch(imgSrc);
                    const imageBytes = await res.arrayBuffer();
                    
                    const embeddedImage = await pdfDoc.embedPng(imageBytes);
                    
                    page.drawImage(embeddedImage, {
                        x: pdfX,
                        y: pdfY,
                        width: finalPdfWidth,
                        height: finalPdfHeight,
                    });
                }

                // 2. Process Text Boxes
                const textarea = overlay.querySelector('.text-overlay');
                if (textarea && textarea.value.trim() !== "") {
                    
                    const textContent = textarea.value;
                    const domFontSize = parseFloat(textarea.style.fontSize);
                    const pdfFontSize = domFontSize * scaleY * 0.75; 

                    // Extract color
                    const tempEl = document.createElement("div");
                    tempEl.style.color = textarea.style.color;
                    document.body.appendChild(tempEl);
                    const computedColor = window.getComputedStyle(tempEl).color;
                    document.body.removeChild(tempEl);
                    const rgbValues = computedColor.match(/\d+/g);
                    const r = parseInt(rgbValues[0]) / 255;
                    const g = parseInt(rgbValues[1]) / 255;
                    const b = parseInt(rgbValues[2]) / 255;

                    const isB = textarea.dataset.isBold === 'true';
                    const isI = textarea.dataset.isItalic === 'true';
                    const font = await getPdfFont(pdfDoc, PDFLib, textarea.dataset.fontFamily, isB, isI);

                    const drawY = pdfY + finalPdfHeight - pdfFontSize;

                    page.drawText(textContent, {
                        x: pdfX + (2 * scaleX),
                        y: drawY,
                        size: pdfFontSize,
                        font: font,
                        color: rgb(r, g, b),
                        lineHeight: pdfFontSize * 1.2
                    });
                }
            }
        }

        const newPdfBytes = await pdfDoc.save();
        download(newPdfBytes, `${originalFileName}_Signed.pdf`, "application/pdf");
        
    } catch (error) {
        console.error("Error editing PDF:", error);
        alert(`Failed to save edits. Error: ${error.message}`);
    }
    
    modal.style.display = 'none';
});
