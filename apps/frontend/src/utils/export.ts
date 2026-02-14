import html2canvas from 'html2canvas';

/**
 * Exports a DOM element as a PNG image
 * @param elementId - ID of the element to capture
 * @param filename - Name for the downloaded file (without extension)
 * @returns Promise that resolves when export is complete
 */
export async function exportToPNG(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);

  if (!element) {
    throw new Error(`Element with ID "${elementId}" not found`);
  }

  try {
    // Capture the element with high quality settings
    // Use the actual element width to prevent clipping
    const elementWidth = element.scrollWidth || element.offsetWidth || 1400;
    const canvas = await html2canvas(element, {
      scale: 2,              // 2x resolution for sharp output
      backgroundColor: '#FFFFFF',
      windowWidth: Math.max(elementWidth + 40, 1400), // Ensure full content is captured
      logging: false,        // Disable console logs
      useCORS: true,         // Enable cross-origin images if needed
    });

    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/png');
    });

    // Create download link and trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the object URL
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('PNG export failed:', error);
    throw new Error(`Failed to export PNG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generates a descriptive filename for the export
 * @param scenarioName - Name of the scenario being exported
 * @param tentDimensions - Tent dimensions {length, width}
 * @returns Formatted filename string
 */
export function generateExportFilename(
  scenarioName: string,
  tentDimensions: { length: number; width: number }
): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  return `Floor Plan - ${scenarioName} - ${tentDimensions.length}m×${tentDimensions.width}m - ${date}`;
}
