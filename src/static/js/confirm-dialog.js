import { defineCustomElement, reactive } from 'vue';

/* ──────────────────────────────────────────────
   1. Custom Element definition
   ────────────────────────────────────────────── */
const ConfirmDialog = defineCustomElement({
  props: {
    open:        { type: Boolean, default: false },
    title:       { type: String,  default: 'Confirm' },
    message:     { type: String,  default: 'Are you sure?' },
    confirmText: { type: String,  default: 'Yes' },
    cancelText:  { type: String,  default: 'No' },
  },
  emits: ['confirm', 'cancel'],
  methods: {
    handleClose() {
      const result = this.$refs.dialog?.returnValue;
      if (result === 'confirm') {
        this.$emit('confirm');
      } else {
        this.$emit('cancel');
      }
      this.$emit('update:open', false);
    },
  },
  watch: {
    open(isOpen) {
      if (isOpen) {
        this.$refs.dialog?.showModal();
      } else {
        this.$refs.dialog?.close();
      }
    },
  },
  styles: `
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
    }
    dialog[open] {
      animation: dialog-fade-in 0.18s ease-out;
    }
    @keyframes dialog-fade-in {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    dialog {
      border: none;
      border-radius: 12px;
      padding: 0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      max-width: 420px;
      width: 90vw;
    }
    .form { padding: 1.5rem; }
    .title {
      margin: 0 0 0.5rem;
      font-size: 1.15rem;
      font-weight: 600;
    }
    .message {
      margin: 0 0 1.5rem;
      color: #555;
      line-height: 1.5;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
    }
    .btn {
      padding: 0.5rem 1.25rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 0.95rem;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn--cancel { background: #fff; }
    .btn--cancel:hover { background: #f5f5f5; }
    .btn--confirm {
      background: #2563eb;
      color: #fff;
      border-color: #2563eb;
    }
    .btn--confirm:hover { background: #1d4ed8; }
  `,
  template: /* html */ `
    <dialog
      ref="dialog"
      @close="handleClose"
      class="dialog"
    >
      <form method="dialog" class="form">
        <h2 class="title">{{ title }}</h2>
        <p class="message">{{ message }}</p>
        <div class="actions">
          <button type="submit" value="cancel" class="btn btn--cancel">
            {{ cancelText }}
          </button>
          <button type="submit" value="confirm" class="btn btn--confirm" autofocus>
            {{ confirmText }}
          </button>
        </div>
      </form>
    </dialog>
  `,
});

customElements.define('confirm-dialog', ConfirmDialog);

/* ──────────────────────────────────────────────
   2. Inject a single shared instance into the DOM
   ────────────────────────────────────────────── */
const sharedDialog = document.createElement('confirm-dialog');
// Wait for the custom element to be defined before
// interacting with its internals
await customElements.whenDefined('confirm-dialog');
document.body.appendChild(sharedDialog);

/* ──────────────────────────────────────────────
   3. Promise-based window.confirm() replacement
   ────────────────────────────────────────────── */
// Preserve the original just in case you need it
const nativeConfirm = window.confirm.bind(window);

// Set properties on the shared element and show it
function showDialog({ title, message }) {
  return new Promise((resolve) => {
    if (title)   sharedDialog.title   = title;
    if (message) sharedDialog.message = message;

    function onConfirm() {
      cleanup();
      resolve(true);
    }
    function onCancel() {
      cleanup();
      resolve(false);
    }
    function cleanup() {
      sharedDialog.removeEventListener('confirm', onConfirm);
      sharedDialog.removeEventListener('cancel', onCancel);
      sharedDialog.open = false;
    }

    sharedDialog.addEventListener('confirm', onConfirm);
    sharedDialog.addEventListener('cancel', onCancel);

    // Trigger the watcher → showModal()
    sharedDialog.open = true;
  });
}

// Overwrite window.confirm with an async version
window.confirm = function confirm(message, title) {
  return showDialog({
    message: message ?? 'Are you sure?',
    title:   title   ?? 'Confirm',
  });
};

// Expose helpers in case you want them
window.nativeConfirm = nativeConfirm;
window.confirmDialog = showDialog;
