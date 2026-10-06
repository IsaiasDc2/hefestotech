export const soloDigitos = (v = "") => String(v).replace(/\D/g, "");

export const formatearTarjeta = (v = "") =>
  soloDigitos(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");

export const formatearVenc = (v = "") => {
  const d = soloDigitos(v).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
};

export const detectarMarca = (v = "") => {
  const d = soloDigitos(v);
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  return d ? "Tarjeta" : "";
};

export const pasaLuhn = (v = "") => {
  const d = soloDigitos(v);
  if (d.length < 15) return false;
  let suma = 0;
  let par = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (par) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    suma += n;
    par = !par;
  }
  return suma % 10 === 0;
};

export const vencimientoValido = (v = "") => {
  const m = String(v).match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!m) return false;
  const mes = Number(m[1]);
  const anio = 2000 + Number(m[2]);
  const ahora = new Date();
  const fin = new Date(anio, mes, 0, 23, 59, 59);
  return fin > ahora;
};
