"use client";

import { useRef, useState } from "react";

type UploadedImage = { key: string; publicUrl: string; previewUrl: string };

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 10 * 1024 * 1024;

export function ImageUploader() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(undefined);
    const selected = [...files].slice(0, 8 - images.length);
    if (selected.some((file) => !acceptedTypes.has(file.type))) {
      setError("Use imagens JPG, PNG ou WebP.");
      return;
    }
    if (selected.some((file) => file.size > maxBytes)) {
      setError("Cada imagem deve ter no máximo 10 MB.");
      return;
    }

    setBusy(true);
    try {
      const uploaded: UploadedImage[] = [];
      for (const file of selected) {
        const signResponse = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            size: file.size,
          }),
        });
        const signed = (await signResponse.json()) as {
          key?: string;
          url?: string;
          publicUrl?: string;
          error?: string;
        };
        if (!signResponse.ok || !signed.key || !signed.url || !signed.publicUrl)
          throw new Error(signed.error ?? "UPLOAD_SIGN_FAILED");

        const storageResponse = await fetch(signed.url, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });
        if (!storageResponse.ok) throw new Error("UPLOAD_STORAGE_FAILED");

        const completeResponse = await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: signed.key }),
        });
        if (!completeResponse.ok) throw new Error("UPLOAD_COMPLETE_FAILED");
        uploaded.push({
          key: signed.key,
          publicUrl: signed.publicUrl,
          previewUrl: URL.createObjectURL(file),
        });
      }
      setImages((current) => [...current, ...uploaded]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Não foi possível enviar a imagem: ${cause.message}`
          : "Não foi possível enviar a imagem.",
      );
    } finally {
      setBusy(false);
    }
  }

  function remove(index: number) {
    setImages((current) => {
      const removed = current[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  return (
    <fieldset className="upload-fieldset">
      <legend>Fotos do anúncio</legend>
      <p className="field-help">
        Envie até 8 fotos reais da peça. A primeira será a capa do anúncio.
      </p>
      <label className="upload-dropzone">
        <strong>{busy ? "Enviando imagens..." : "Selecionar imagens"}</strong>
        <span>JPG, PNG ou WebP, até 10 MB por arquivo</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy || images.length >= 8}
          onChange={(event) => void upload(event.target.files)}
        />
      </label>
      {error ? <p className="notice error">{error}</p> : null}
      {images.length ? (
        <div className="upload-preview-grid">
          {images.map((image, index) => (
            <div className="upload-preview" key={image.key}>
              {/* Prévia local do arquivo selecionado. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.previewUrl}
                alt={`Foto ${index + 1} do anúncio`}
              />
              <input type="hidden" name="imageUrls" value={image.publicUrl} />
              <button type="button" onClick={() => remove(index)}>
                Remover
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
