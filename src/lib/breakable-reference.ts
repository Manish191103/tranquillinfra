/**
 * Break opportunities inside a published reference number, and nowhere else.
 *
 * `2103/HMDA/SWDL/2026` is 19 unbroken characters and `REA01100108192` is 14 with
 * no separator, so at display size they overflow their container at every phone
 * width and must break somewhere. `overflow-wrap: anywhere` breaks wherever the
 * arithmetic lands — measured at 320px, the HMDA number rendered as 265px then a
 * 27px orphan — and a statutory number split like that is one a buyer cannot
 * verify. So the two places these numbers are meant to be read (after each `/`,
 * and after a leading letter prefix) become `<wbr>`, and the caller keeps
 * `overflow-wrap: break-word` for anything else.
 *
 * `<wbr>` is a break opportunity and nothing else: the rendered string, copied
 * text and extracted text are byte-identical either way.
 *
 * Only ever call this on a reference — a registration, file or licence number.
 * Never on prose: a sentence should wrap at its spaces.
 */
export function breakableReference(value: string): string {
  return value.replaceAll('/', '/<wbr>').replace(/^([A-Za-z]+)(?=\d)/, '$1<wbr>');
}
