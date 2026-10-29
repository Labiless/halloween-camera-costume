// Configurazione della scena "apocalisse" (bottone 3).
//
// Metti qui le GIF da mostrare, in ordine sparso: vengono pescate a caso.
// Puoi usare:
//   - file locali messi nella cartella public/gifs/  →  '/gifs/nome.gif'
//   - link diretti a una GIF                          →  'https://.../nome.gif'
//
// Consiglio: usa file locali, così alla festa funziona anche senza internet.
// I link devono puntare al file .gif vero e proprio (non alla pagina che lo contiene).
// Le due demo sono solo segnaposto: sostituiscile con le tue.
export const GIFS = [
  'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnBkOG50YWllbnM1c2puc3BrZXh4bWZsaDNoYXhpN3VsNTIwY2R2MCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/M801Gs5uiVzWjWEsnu/giphy.gif  ',
  'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmFldW95NDV3bXk5bnE5eXRkNjc1MnBuaTZob214cmd4MjgwdDc4MyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/WiMooPy847jUIHe2el/giphy.gif',
  'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExMmt5cDZsZGVtYXVldXhtYmZ3YnB3d2J4eWIxbW1tOHZtMjBxbDJpZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/bs35auYhZeFgMOnh3I/giphy.gif',
  'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExb2FxaTdiN2s3ZzkzcW50b2xzOTVoNm0xa3Vhb2p2bm15NmhibzlobSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/13kVMbsjnsoIuI/giphy.gif',
  'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNDN1aDdhaWh4bHQ5bzZ4M3JoMWh3bnd5YXB1bjN3enpoZTAzNzB6MiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oz8xKtSzwkTznGe9q/giphy.gif',
  'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExaTA5N2U0aXFuems1ODE5eHJwMnc3YjRmbjlyYm80Mmg1NWhkYWlrYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/r8iGaIZuIP0uPBMxsp/giphy.gif',
  'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExc3U1eXg0aXg4dXd5dHpvb2ZpOGRvdWZyY2h3NjlqYzcyOW02b3M2ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/H6bG8EKxGw2hkF9jyE/giphy.gif',
  'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWE3MHc1ZnY2ZGs2ZXZ6a2VqN2dxY3F5cnA4ZTMzems3OTJjcXN3YSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Y41nZSf1UKy8h8bWwC/giphy.gif',
  'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTJ1dXpoa3FuaW1jOXR4enp3MTk4cDE4am9mNDRtcGQxb3J4YnNnMyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/fAiQjXDibHlO7jvj29/giphy.gif',
  'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExMTVuMGVvOHJ4cmJ6b3lnMmJkNWFkajY2NWF0NzdrbjhxbTN5bHJ2ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ekeUK4GyQUnbov74On/giphy.gif',
  'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExazg4eGpqdjNncjFwcnVzcDd4eGx0dndldjB5a3A0cGcxcGFxOXlsciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/QR7SyBe7tQfPq/giphy.gif',
  'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzhmamR1azYxNGU4djRxeG1ianhzajBsNnF6bWFkaDltazh2NmZuNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/AyTGnIGvHY14E1tLuH/giphy.gif',
  'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExYW1iYzNvaWdvNm44aWZoc3BhMTNpdnQ5eTBlOGt3MmZrdXJiMjRubCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/6D0NvqxQkbspEMMmga/giphy.gif',
  'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExNDh2cDRneDVkczhvZTltbDN5Z2ZwMDN5bjcxZmZidmFrZHhsc3BnbCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/PqkT41QHCve8tQ7fH0/giphy.gif',
  'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExaTlnOGM5ZWN3cDRtdmo4dHU5amNmMG44OWVzc204MXhkc2Fnc3ZtZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/XoCKOOr7LtCmI/giphy.gif',
  'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZnlkbnNnb3BwZjk4ano0MnA2ZnA0bnJ0eDZobjNmejM4dGltbWk1cyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/XhiL9wZKBdVwExaUbc/giphy.gif',
  'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnR3a205bW1oNjcxejJweGE0djVzb29sc3Z0b3liZWNrd3B3ODZ2ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l1KVaGr2NKkBtpSrS/giphy.gif',
  'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExOWo0NWQ4dWQ2ajdueXRrNGk3YmM4NXNoYnRqZmh0cGZvbWh6bTg4cSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3og0IGWmdrIm2hkFMc/giphy.gif',
  'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNWwxYXBkYWVkMHN1MmdjNGgwdXloMHkzbWd5a3RpMXZ6dDhjb3RodyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7buaqyzWQtE5eSt2/giphy.gif',
  'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExYWlkMnl1ZmplN2Rrc2p5ODNmZTZ1em0xaWF4NmhodTI1eDFjMW1tOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0IypHLAHGm63VylW/giphy.gif',
  'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExMHJta2NldXNwb2tseXU5dnVyMnVuYnF3dm5waTY5bDF1ZXVvNGlwMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPkdicB1VQuEU9i/giphy.gif',
  'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3ZvcW1jbGJscmwxcXc4MjV3NjlkcTdteTRib29oc3o4bTZvZG5leCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPec0OGdQ8XI7S0/giphy.gif'
];

// Quanto resta a schermo ogni GIF (secondi, scelto a caso tra min e max)
export const GIF_MIN_SECONDS = 0.3;
export const GIF_MAX_SECONDS = 1;

// Durata della transizione glitch tra una GIF e l'altra (secondi)
export const GLITCH_SECONDS = 0.2;

