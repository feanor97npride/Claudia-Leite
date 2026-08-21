import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

async function renderCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(node, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
  });
}

export async function exportNodeAsPNG(node: HTMLElement, fileName: string) {
  const canvas = await renderCanvas(node);
  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
}

export async function exportNodeAsPDF(node: HTMLElement, fileName: string) {
  const canvas = await renderCanvas(node);
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, imgHeight);
  } else {
    // Scale down to fit a single page rather than spilling onto a second one.
    const scale = pageHeight / imgHeight;
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth * scale, pageHeight);
  }

  pdf.save(fileName);
}
