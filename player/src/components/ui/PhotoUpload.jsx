import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import Avatar from './Avatar';
import Button from './Button';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_SIDE = 400;

/** Downscale to keep data URLs small (the mock DB lives in localStorage). */
function resize(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Profile photo / logo picker with preview. Value is a data URL (or remote URL from the API). */
export default function PhotoUpload({ value, onChange, name, label, shape = 'circle', fallback }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [error, setError] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError(t('validation.imageType'));
    if (file.size > MAX_BYTES) return setError(t('validation.imageSize', { size: 2 }));
    setError(null);
    try {
      onChange(await resize(file));
    } catch {
      setError(t('validation.imageType'));
    }
  };

  return (
    <div className="flex items-center gap-4">
      {fallback && !value ? (
        fallback
      ) : shape === 'circle' ? (
        <Avatar name={name} src={value} size="xl" />
      ) : (
        <span className="grid size-20 place-items-center overflow-hidden rounded-2xl border border-line bg-surface-2">
          {value && <img src={value} alt="" className="size-full object-contain p-1.5" />}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-3">{t('common.photoHint')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={Camera} onClick={() => inputRef.current?.click()}>
            {value ? t('common.change') : t('common.upload')}
          </Button>
          {value && (
            <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => onChange(null)}>
              {t('common.remove')}
            </Button>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={onFile} aria-label={label} />
      </div>
    </div>
  );
}
