import { create } from "zustand";

const TEXTO = {
  es: {
    "topbar.envio": "Envíos a todo el país",
    "topbar.idioma": "Idioma",
    "nav.buscarPh": "Buscá tu placa, notebook o periférico…",
    "nav.buscarAria": "Buscar productos",
    "nav.buscar": "Buscar",
    "nav.registrate": "Registrate",
    "nav.sesion": "Iniciá sesión",
    "nav.carrito": "Abrir carrito",
    "nav.productos": "productos",
    "nav.categorias": "Categorías",
    "cat.productos": "Productos",
    "cat.notebooks": "Notebooks",
    "cat.pcs": "PCs Armadas",
    "cat.arma": "Armá tu PC",
    "cat.outlet": "Outlet",
    "nav.ayuda": "Ayuda",
    "nav.posventa": "Servicio de Posventa",
    "ft.newsTitulo": "Recibí ofertas y novedades",
    "ft.newsTexto": "Componentes, periféricos y PCs armadas con garantía oficial. Equipá tu setup con productos de calidad.",
    "ft.newsOk": "¡Listo! Revisá tu correo para confirmar la suscripción.",
    "ft.newsEmail": "Correo electrónico",
    "ft.suscribir": "Suscribirme",
    "ft.marcaTexto": "Componentes, periféricos y PCs armadas con garantía oficial. Equipá tu setup con productos de calidad.",
    "ft.garantia": "Garantía oficial",
    "ft.envioPais": "Envíos a todo el país",
    "ft.nav": "Navegación",
    "ft.inicio": "Inicio",
    "ft.productos": "Productos",
    "ft.cuenta": "Mi cuenta",
    "ft.arma": "Armá tu PC",
    "ft.ayuda": "Ayuda",
    "ft.ayudaLink": "Ayuda",
    "ft.posventa": "Posventa",
    "ft.envios": "Envíos",
    "ft.cambios": "Cambios y devoluciones",
    "ft.faq": "Preguntas frecuentes",
    "ft.contacto": "Contacto",
    "ft.pagos": "Métodos de pago",
    "ft.derechos": "Todos los derechos reservados",
    "ft.nosotros": "Nosotros",
    "ft.contactanos": "Contactanos",
    "ft.hechoEn": "Hecho en Argentina",
  },
  en: {
    "topbar.envio": "Nationwide shipping",
    "topbar.idioma": "Language",
    "nav.buscarPh": "Search GPUs, notebooks or peripherals…",
    "nav.buscarAria": "Search products",
    "nav.buscar": "Search",
    "nav.registrate": "Sign up",
    "nav.sesion": "Sign in",
    "nav.carrito": "Open cart",
    "nav.productos": "items",
    "nav.categorias": "Categories",
    "cat.productos": "Products",
    "cat.notebooks": "Notebooks",
    "cat.pcs": "Prebuilt PCs",
    "cat.arma": "Build your PC",
    "cat.outlet": "Outlet",
    "nav.ayuda": "Help",
    "nav.posventa": "After-sales service",
    "ft.newsTitulo": "Get deals and news",
    "ft.newsTexto": "Components, peripherals and prebuilt PCs with official warranty. Gear up your setup with quality products.",
    "ft.newsOk": "Done! Check your email to confirm the subscription.",
    "ft.newsEmail": "Email address",
    "ft.suscribir": "Subscribe",
    "ft.marcaTexto": "Components, peripherals and prebuilt PCs with official warranty. Gear up your setup with quality products.",
    "ft.garantia": "Official warranty",
    "ft.envioPais": "Nationwide shipping",
    "ft.nav": "Navigation",
    "ft.inicio": "Home",
    "ft.productos": "Products",
    "ft.cuenta": "My account",
    "ft.arma": "Build your PC",
    "ft.ayuda": "Help",
    "ft.ayudaLink": "Help",
    "ft.posventa": "After-sales",
    "ft.envios": "Shipping",
    "ft.cambios": "Returns & exchanges",
    "ft.faq": "FAQ",
    "ft.contacto": "Contact",
    "ft.pagos": "Payment methods",
    "ft.derechos": "All rights reserved",
    "ft.nosotros": "About us",
    "ft.contactanos": "Contact us",
    "ft.hechoEn": "Made in Argentina",
  },
};

export function t(idioma, clave) {
  return TEXTO[idioma]?.[clave] ?? TEXTO.es[clave] ?? clave;
}

const useIdiomaStore = create((set) => ({
  idioma: (() => {
    try {
      const v = localStorage.getItem("ht-idioma");
      return v === "en" ? "en" : "es";
    } catch {
      return "es";
    }
  })(),
  setIdioma: (idioma) => {
    try {
      localStorage.setItem("ht-idioma", idioma);
    } catch {
      /* almacenamiento no disponible */
    }
    document.documentElement.lang = idioma === "en" ? "en" : "es";
    set({ idioma });
  },
}));

try {
  document.documentElement.lang =
    localStorage.getItem("ht-idioma") === "en" ? "en" : "es";
} catch {
  /* almacenamiento no disponible */
}

export default useIdiomaStore;
