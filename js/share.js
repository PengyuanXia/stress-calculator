/**
 * share.js - Model Serialization, URL Hash Sharing, QR Code Generator & Modal
 */

export class ShareManager {
  constructor(app) {
    this.app = app;
    this.modal = document.getElementById('modalShare');
    this.inpUrl = document.getElementById('inpShareUrl');
    this.qrCanvas = document.getElementById('shareQrCanvas');
    this.btnCopy = document.getElementById('btnCopyShareUrl');
    this.btnDownloadQr = document.getElementById('btnDownloadQr');
    this.btnClose = document.getElementById('btnCloseShareModal');
    this.toast = document.getElementById('appToast');

    this.initEvents();
  }

  initEvents() {
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.close());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.classList.contains('open')) {
        this.close();
      }
    });

    if (this.btnCopy) {
      this.btnCopy.addEventListener('click', () => this.copyToClipboard());
    }

    if (this.btnDownloadQr) {
      this.btnDownloadQr.addEventListener('click', () => this.downloadQr());
    }
  }

  /**
   * Encode model to compact URL-safe string
   */
  async encodeModel(modelState) {
    const compact = {
      s: modelState.shapeType,
      p: modelState.params,
      ld: modelState.loading,
      f: modelState.forces,
      m: modelState.material,
      y: modelState.probeY !== undefined ? Number(modelState.probeY.toFixed(2)) : 0,
      z: modelState.probeZ !== undefined ? Number(modelState.probeZ.toFixed(2)) : 0,
      l: modelState.lang || 'en'
    };

    const json = JSON.stringify(compact);

    if (window.CompressionStream) {
      try {
        const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        const buffer = await new Response(stream).arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return 'z:' + b64;
      } catch (e) {
        console.warn('CompressionStream failed, falling back to base64', e);
      }
    }

    return btoa(encodeURIComponent(json));
  }

  /**
   * Decode URL-safe string back to model state
   */
  async decodeModel(encoded) {
    if (!encoded) return null;

    try {
      let jsonStr = '';
      if (encoded.startsWith('z:')) {
        const b64 = encoded.substring(2).replace(/-/g, '+').replace(/_/g, '/');
        let padded = b64;
        while (padded.length % 4) padded += '=';
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        jsonStr = await new Response(stream).text();
      } else {
        jsonStr = decodeURIComponent(atob(decodeURIComponent(encoded)));
      }

      const data = JSON.parse(jsonStr);
      return {
        shapeType: data.s,
        params: data.p,
        loading: data.ld,
        forces: data.f,
        material: data.m,
        probeY: data.y,
        probeZ: data.z,
        lang: data.l
      };
    } catch (err) {
      console.error('Failed to decode model from URL hash:', err);
      return null;
    }
  }

  /**
   * Open share modal, update URL and render QR code
   */
  async open(modelState) {
    const encoded = await this.encodeModel(modelState);
    const shareUrl = `${window.location.origin}${window.location.pathname}#model=${encoded}`;

    // Update browser URL hash without full reload
    window.history.replaceState(null, '', `#model=${encoded}`);

    if (this.inpUrl) {
      this.inpUrl.value = shareUrl;
    }

    // Auto copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        this.showToast(this.app.t('copiedToast') || 'Link copied to clipboard!');
      }).catch(() => {});
    }

    // Generate QR Code with QRious
    if (this.qrCanvas && window.QRious) {
      new window.QRious({
        element: this.qrCanvas,
        value: shareUrl,
        size: 260,
        level: 'M',
        background: '#0f172a',
        foreground: '#38bdf8'
      });
    }

    if (this.modal) {
      this.modal.classList.add('open');
    }
  }

  close() {
    if (this.modal) {
      this.modal.classList.remove('open');
    }
  }

  copyToClipboard() {
    if (!this.inpUrl) return;
    const url = this.inpUrl.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast(this.app.t('copiedToast') || 'Link copied to clipboard!');
      });
    } else {
      this.inpUrl.select();
      document.execCommand('copy');
      this.showToast(this.app.t('copiedToast') || 'Link copied to clipboard!');
    }
  }

  downloadQr() {
    if (!this.qrCanvas) return;
    try {
      const link = document.createElement('a');
      link.download = 'StructLab_Stress_Model_QR.png';
      link.href = this.qrCanvas.toDataURL('image/png');
      link.click();
      this.showToast('QR Code downloaded!');
    } catch (e) {
      console.error(e);
    }
  }

  showToast(msg) {
    if (!this.toast) return;
    this.toast.textContent = msg;
    this.toast.classList.add('show');
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2400);
  }
}
