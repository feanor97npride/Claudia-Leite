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

  // The node is always rendered at a fixed 16:9 size (see SnapshotView), so
  // the PDF page is sized to match that exact aspect ratio.
  const widthMM = (node.offsetWidth / 96) * 25.4;
  const heightMM = (node.offsetHeight / 96) * 25.4;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [widthMM, heightMM] });
  pdf.addImage(imgData, 'JPEG', 0, 0, widthMM, heightMM);
  pdf.save(fileName);
}
