// navigator.clipboard needs a secure context, which a bare http://100.x.x.x:port
// tailnet address is not, so fall back to a selection copy that works everywhere.
export async function copyText(value: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return copyThroughHiddenField(value);
    }
  }
  return copyThroughHiddenField(value);
}

function copyThroughHiddenField(value: string): boolean {
  const holder = document.createElement('textarea');
  holder.value = value;
  holder.setAttribute('readonly', '');
  holder.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
  document.body.appendChild(holder);
  holder.select();
  const copied = document.execCommand('copy');
  holder.remove();
  return copied;
}
