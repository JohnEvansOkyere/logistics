"use client";

import styles from "./documentPreview.module.css";

type PrintSampleButtonProps = {
  sampleId: string;
  sampleName: string;
};

export function PrintSampleButton({
  sampleId,
  sampleName,
}: PrintSampleButtonProps) {
  function printSample() {
    const root = document.documentElement;
    root.dataset.printTarget = sampleId;

    const clearPrintTarget = () => {
      delete root.dataset.printTarget;
    };

    window.addEventListener("afterprint", clearPrintTarget, { once: true });
    window.print();
  }

  return (
    <button
      aria-label={`Print the ${sampleName} sample`}
      className={styles.printButton}
      onClick={printSample}
      type="button"
    >
      Print this sample
    </button>
  );
}
