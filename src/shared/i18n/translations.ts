import type { AppLanguage } from "@/features/settings/types";

export interface TranslationDictionary {
  common: {
    cancel: string;
    delete: string;
    deleteAll: string;
    rename: string;
    duplicate: string;
    close: string;
    defaultBadge: string;
  };
  titlebar: {
    visitGithub: string;
    searchPlaceholder: string;
    minimize: string;
    maximize: string;
    restore: string;
    close: string;
    minimizeAria: string;
    maximizeAria: string;
    closeAria: string;
  };
  sidebar: {
    allSnippets: string;
    favorites: string;
    uncategorized: string;
    trash: string;
    foldersHeader: string;
    createRootFolder: string;
    noFolders: string;
    newFolder: string;
    untitledFolder: string;
    tagsHeader: string;
    createTag: string;
    noTags: string;
    tagRenamePlaceholder: string;
    changeColor: string;
    selectColorAria: (color: string) => string;
    settings: string;
    settingsTooltip: string;
    settingsAria: string;
    resizeFoldersTooltip: string;
  };
  tagModal: {
    title: string;
    nameLabel: string;
    namePlaceholder: string;
    nameRequiredError: string;
    createFailedError: string;
    colorLabel: string;
    createButton: string;
  };
  snippetList: {
    searchTitle: (query: string) => string;
    tagFallback: string;
    folderFallback: string;
    foldersTitle: string;
    snippetsTitle: string;
    newSnippetTooltip: string;
    newSnippetAria: string;
    trashEmptyTitle: string;
    trashEmptySubtitle: string;
    noSnippetsTitle: string;
    noSnippetsSubtitle: string;
    createSnippetButton: string;
    restoreToUncategorized: string;
    deletePermanently: string;
    untitledSnippet: string;
    copySuffix: string;
    resizeListTooltip: string;
  };
  workspace: {
    trashSelectedTitle: string;
    trashSelectedSubtitle: string;
    noSnippetSelectedTitle: string;
    noSnippetSelectedSubtitle: string;
  };
  editor: {
    untitledPlaceholder: string;
    notesTooltip: string;
    notesHeader: string;
    notesPlaceholder: string;
    addFragmentTooltip: string;
    tagsTooltip: string;
    tagsHeader: string;
    tagsSelectedCount: (count: number) => string;
    noTagsCreatedYet: string;
    markFavoriteTooltip: string;
    unmarkFavoriteTooltip: string;
    toggleFavoriteAria: string;
    copiedTooltip: string;
    copyCodeTooltip: string;
    copyCodeAria: string;
    copyNoteTooltip: string;
    copyNoteAria: string;
    copyWithFormatting: string;
    copyWithFormattingHint: string;
    copyWithoutFormatting: string;
    copyWithoutFormattingHint: string;
    deleteSnippetTooltip: string;
    fragmentTabTooltip: (label: string) => string;
    closeFragmentTooltip: (label: string) => string;
    addFragmentShortTooltip: string;
    searchLanguagePlaceholder: string;
    autoDetect: string;
    languageSelectorTooltip: string;
    linesCount: (count: number) => string;
    charsCount: (count: number) => string;
    markdown: {
      previewTooltip: string;
      codeTooltip: string;
      previewAria: string;
      copyCodeBlock: string;
      copiedBlock: string;
      diagramRendering: string;
      diagramRenderError: string;
      diagramSourceToggle: string;
      diagramVisualToggle: string;
      diagramZoomOut: string;
      diagramZoomIn: string;
      diagramZoomReset: string;
      copySvg: string;
      emptySvgError: string;
    };
    richText: {
      toolbarAriaLabel: string;
      hideFormattingBarTooltip: string;
      showFormattingBarTooltip: string;
      showFormattingBarLabel: string;
      textStyleTooltip: string;
      blocksCategory: string;
      specialBlocksCategory: string;
      listsCategory: string;
      listsMenuTooltip: string;
      shortTitle: string;
      shortHeading: string;
      shortSubtitle: string;
      shortBody: string;
      shortQuote: string;
      bold: string;
      italic: string;
      underline: string;
      strikethrough: string;
      highlight: string;
      highlightColor: string;
      highlightClear: string;
      title: string;
      heading: string;
      subtitle: string;
      body: string;
      monospace: string;
      bulletList: string;
      dashList: string;
      orderedList: string;
      blockquote: string;
      checklistTooltip: string;
      tableTooltip: string;
      insertTable: string;
      tableSizeLabel: (rows: number, cols: number) => string;
      tableRowsSection: string;
      addRowBefore: string;
      addRowAfter: string;
      deleteRow: string;
      tableColsSection: string;
      addColumnBefore: string;
      addColumnAfter: string;
      deleteColumn: string;
      toggleHeaderRow: string;
      deleteTable: string;
      linkTooltip: string;
      linkDisplayNameLabel: string;
      linkDisplayNamePlaceholder: string;
      linkUrlLabel: string;
      linkPlaceholder: string;
      applyLink: string;
      removeLink: string;
      textColorTooltip: string;
      textColorDefault: string;
      noColorLabel: string;
      customColorTooltip: string;
      alignTooltip: string;
      alignLeft: string;
      alignCenter: string;
      alignRight: string;
      alignJustify: string;
      clearFormatting: string;
      placeholder: string;
      contextPanelSection: string;
      contextInsertTable: string;
      contextAddBlockquote: string;
      contextAddCodeBlock: string;
      contextShowFormattingBar: string;
      contextTextFormat: string;
      contextBlockStyle: string;
      contextTextColor: string;
      contextHighlightColor: string;
      contextAlignment: string;
      contextLists: string;
      contextTableSection: string;
      contextSpellingCategory: string;
      contextIgnoreWord: string;
      contextAddToDictionary: string;
      contextNoSuggestions: string;
      contextDisableSpellcheck: string;
      contextEnableSpellcheck: string;
      contextSpellcheckDisabledNote: string;
      contextCut: string;
      contextCopy: string;
      contextCopyFormatted: string;
      contextCopyMarkdown: string;
      contextPaste: string;
      contextSelectAll: string;
      insertImageTooltip: string;
      contextInsertImage: string;
      imageLoading: string;
      imageMissing: string;
      imageCopyTooltip: string;
      imageCopiedTooltip: string;
      imageDuplicateTooltip: string;
      imageDeleteTooltip: string;
      imageOriginalSize: string;
      imageAlignLeft: string;
      imageAlignCenter: string;
      imageAlignRight: string;
      imageDragToResizeTooltip: string;
      imagePasteErrorTitle: string;
    };
  };
  modals: {
    folderDeleteSingleTitle: (name: string) => string;
    folderDeleteMultiTitle: string;
    folderDeleteSingleBody: string;
    folderDeleteMultiBody: string;
    batchSnippetDeleteTitle: string;
    batchSnippetDeleteBody: string;
    permanentDeleteTitle: string;
    permanentDeleteBody: string;
    snippetDeleteTitle: string;
    snippetDeleteBodyPrefix: string;
    snippetDeleteBodySuffix: string;
  };
  settings: {
    modalTitle: string;
    closeTooltip: string;
    closeAria: string;
    optionsHeader: string;
    pressEscPrefix: string;
    pressEscSuffix: string;
    sections: {
      appearance: {
        label: string;
        description: string;
      };
      editor: {
        label: string;
        description: string;
      };
      general: {
        label: string;
        description: string;
      };
      about: {
        label: string;
        description: string;
      };
    };
    general: {
      title: string;
      subtitle: string;
      languageCategory: string;
      languageName: string;
      languageDescription: string;
      spanishOption: string;
      englishOption: string;
      backupCategory: string;
      backupName: string;
      backupDescription: string;
      autoSyncBadge: string;
      autoSyncStats: (snippets: number, folders: number, tags: number) => string;
      lastSyncedLabel: string;
      openBackupLocationButton: string;
      exportBackupButton: string;
      exportJsonlBackupButton: string;
      importBackupButton: string;
      assetsCountLabel: (count: number) => string;
      importConfirmAssetsLabel: (count: number) => string;
      exportSuccessMessage: (snippets: number, folders: number, tags: number) => string;
      importSuccessMessage: (snippets: number, folders: number, tags: number) => string;
      importConfirmModalTitle: string;
      importConfirmModalWarning: string;
      importConfirmFileLabel: string;
      importConfirmFormatLabel: string;
      importConfirmSummaryLabel: (snippets: number, folders: number, tags: number) => string;
      importConfirmButton: string;
    };
    appearance: {
      title: string;
      subtitle: string;
      themeCategory: string;
      themeName: string;
      themeDescription: string;
      customThemesGroup: string;
      exploreThemeButton: string;
      exploreThemeTooltip: string;
      activePaletteLabel: string;
      darkMode: string;
      lightMode: string;
      fontSizeCategory: string;
      fontSizeName: string;
      fontSizeDescription: string;
      fontSizeNote: string;
      jsonSectionTitle: string;
      localConfigThemeTag: string;
      reloadButton: string;
      reloadTooltip: string;
      openFolderButton: string;
      openFolderTooltip: string;
      jsonDescriptionPrefix: string;
      jsonDescriptionSuffix: string;
      copyPathTooltip: string;
      copiedButton: string;
      copyButton: string;
      downloadTemplateButton: string;
      installedCustomThemesTitle: string;
      activeBadge: string;
      activateButton: string;
      deleteCustomThemeTooltip: string;
      livePreviewTitle: string;
      livePreviewComment: (name: string, mode: string) => string;
      livePreviewReturn: string;
      themeImportedSuccess: (name: string) => string;
      configReloadedSuccess: string;
      configReloadError: string;
    };
    editorSection: {
      title: string;
      subtitle: string;
      category: string;
      tabSizeName: string;
      tabSizeDescription: string;
      spacesCount: (n: number) => string;
      lineNumbersName: string;
      lineNumbersDescription: string;
      enableLineNumbers: string;
      wordWrapName: string;
      wordWrapDescription: string;
      enableWordWrap: string;
      spellcheckName: string;
      spellcheckDescription: string;
      enableSpellcheck: string;
    };
    about: {
      title: string;
      subtitle: string;
      appDescription: string;
      developerLabel: string;
      licenseLabel: string;
      copyrightLabel: string;
      copyrightValue: string;
      contactHeader: string;
      emailLabel: string;
    };
  };
}

export const TRANSLATIONS: Record<AppLanguage, TranslationDictionary> = {
  es: {
    common: {
      cancel: "Cancelar",
      delete: "Eliminar",
      deleteAll: "Eliminar todos",
      rename: "Renombrar",
      duplicate: "Duplicar",
      close: "Cerrar",
      defaultBadge: "(Predeterminado)",
    },
    titlebar: {
      visitGithub: "Visitar repositorio GitHub de CodeStash",
      searchPlaceholder: "Buscar snippets ...",
      minimize: "Minimizar",
      maximize: "Maximizar",
      restore: "Restaurar",
      close: "Cerrar",
      minimizeAria: "Minimizar ventana",
      maximizeAria: "Maximizar ventana",
      closeAria: "Cerrar ventana",
    },
    sidebar: {
      allSnippets: "Todos los snippets",
      favorites: "Favoritos",
      uncategorized: "Sin categoría",
      trash: "Basurero",
      foldersHeader: "Carpetas",
      createRootFolder: "Crear carpeta raíz",
      noFolders: "Sin carpetas",
      newFolder: "Nueva carpeta",
      untitledFolder: "Carpeta sin título",
      tagsHeader: "Etiquetas",
      createTag: "Crear etiqueta",
      noTags: "Sin etiquetas",
      tagRenamePlaceholder: "Nombre de etiqueta...",
      changeColor: "Cambiar color",
      selectColorAria: (color: string) => `Seleccionar color ${color}`,
      settings: "Configuración",
      settingsTooltip: "Configuración (Ctrl+,)",
      settingsAria: "Abrir panel de configuración",
      resizeFoldersTooltip: "Arrastra para redimensionar panel de carpetas",
    },
    tagModal: {
      title: "Nueva etiqueta",
      nameLabel: "Nombre de la etiqueta",
      namePlaceholder: "ej. backend, async, auth...",
      nameRequiredError: "El nombre de la etiqueta es obligatorio",
      createFailedError: "Error al crear la etiqueta",
      colorLabel: "Color de la etiqueta",
      createButton: "Crear etiqueta",
    },
    snippetList: {
      searchTitle: (query: string) => `Búsqueda: "${query}"`,
      tagFallback: "Etiqueta",
      folderFallback: "Carpeta",
      foldersTitle: "Carpetas",
      snippetsTitle: "Snippets",
      newSnippetTooltip: "Nuevo snippet (Ctrl+N)",
      newSnippetAria: "Nuevo snippet",
      trashEmptyTitle: "El Basurero está vacío",
      trashEmptySubtitle: "Los elementos que elimines aparecerán aquí.",
      noSnippetsTitle: "No se encontraron snippets",
      noSnippetsSubtitle: "Crea un nuevo snippet o ajusta tu filtro de búsqueda.",
      createSnippetButton: "Crear Snippet",
      restoreToUncategorized: "Recuperar en Sin categoría",
      deletePermanently: "Eliminar Permanentemente",
      untitledSnippet: "Snippet sin título",
      copySuffix: "(Copia)",
      resizeListTooltip: "Arrastra para redimensionar lista de snippets",
    },
    workspace: {
      trashSelectedTitle: "Basurero seleccionado",
      trashSelectedSubtitle: "Selecciona un snippet de la lista para previsualizarlo o restaurarlo.",
      noSnippetSelectedTitle: "Ningún snippet seleccionado",
      noSnippetSelectedSubtitle: "Haz clic en + para crear un nuevo snippet",
    },
    editor: {
      untitledPlaceholder: "Snippet sin título",
      notesTooltip: "Notas / Descripción",
      notesHeader: "Notas y descripción",
      notesPlaceholder: "Añade notas o una descripción para este snippet...",
      addFragmentTooltip: "Añadir pestaña de fragmento",
      tagsTooltip: "Etiquetas",
      tagsHeader: "Etiquetas",
      tagsSelectedCount: (count: number) => `${count} seleccionadas`,
      noTagsCreatedYet: "Aún no hay etiquetas creadas.",
      markFavoriteTooltip: "Marcar como favorito",
      unmarkFavoriteTooltip: "Quitar de favoritos",
      toggleFavoriteAria: "Alternar favorito",
      copiedTooltip: "¡Copiado!",
      copyCodeTooltip: "Copiar código",
      copyCodeAria: "Copiar código del snippet",
      copyNoteTooltip: "Copiar nota",
      copyNoteAria: "Opciones de copiado de la nota",
      copyWithFormatting: "Copiar con formato",
      copyWithFormattingHint: "Para Word, WhatsApp, Docs...",
      copyWithoutFormatting: "Copiar sin formato (Markdown)",
      copyWithoutFormattingHint: "Markdown limpio (Obsidian, etc.)",
      deleteSnippetTooltip: "Eliminar snippet",
      fragmentTabTooltip: (label: string) =>
        `${label} (Arrastra horizontalmente • Doble clic para renombrar)`,
      closeFragmentTooltip: (label: string) => `Cerrar ${label}`,
      addFragmentShortTooltip: "Añadir fragmento",
      searchLanguagePlaceholder: "Buscar lenguaje...",
      autoDetect: "Autodetectar",
      languageSelectorTooltip: "Selector de lenguaje (Clic para cambiar)",
      linesCount: (count: number) => `${count} líneas`,
      charsCount: (count: number) => `${count} caracteres`,
      markdown: {
        previewTooltip: "Previsualizar Markdown",
        codeTooltip: "Ver código Markdown",
        previewAria: "Alternar vista previa de Markdown",
        copyCodeBlock: "Copiar bloque",
        copiedBlock: "Copiado",
        diagramRendering: "Renderizando diagrama...",
        diagramRenderError: "No se pudo renderizar el diagrama",
        diagramSourceToggle: "Ver código",
        diagramVisualToggle: "Ver diagrama",
        diagramZoomOut: "Alejar diagrama",
        diagramZoomIn: "Acercar diagrama",
        diagramZoomReset: "Restablecer zoom (100%)",
        copySvg: "Copiar SVG",
        emptySvgError: "El bloque SVG no contiene elementos gráficos válidos.",
      },
      richText: {
        toolbarAriaLabel: "Herramientas de formato de texto",
        hideFormattingBarTooltip: "Ocultar menú de formato",
        showFormattingBarTooltip: "Mostrar menú de formato",
        showFormattingBarLabel: "Formato",
        textStyleTooltip: "Estilos de bloque y jerarquía",
        blocksCategory: "Jerarquía",
        specialBlocksCategory: "Bloques",
        listsCategory: "Formatos de lista",
        listsMenuTooltip: "Listas y verificación",
        shortTitle: "Título",
        shortHeading: "Encab.",
        shortSubtitle: "Subtít.",
        shortBody: "Cuerpo",
        shortQuote: "Cita",
        bold: "Negrita",
        italic: "Cursiva",
        underline: "Subrayado",
        strikethrough: "Tachado",
        highlight: "Resaltar texto",
        highlightColor: "Color de resaltado",
        highlightClear: "Quitar resaltado",
        title: "Título",
        heading: "Encabezado",
        subtitle: "Subtítulo",
        body: "Cuerpo",
        monospace: "Monoestilo",
        bulletList: "Lista con viñetas",
        dashList: "Lista con guiones",
        orderedList: "Lista enumerada",
        blockquote: "Cita en bloque",
        checklistTooltip: "Lista de verificación",
        tableTooltip: "Tabla",
        insertTable: "Insertar tabla",
        tableSizeLabel: (rows: number, cols: number) => `Tabla ${rows} × ${cols}`,
        tableRowsSection: "Filas",
        addRowBefore: "Agregar fila arriba",
        addRowAfter: "Agregar fila abajo",
        deleteRow: "Eliminar fila",
        tableColsSection: "Columnas",
        addColumnBefore: "Agregar columna izquierda",
        addColumnAfter: "Agregar columna derecha",
        deleteColumn: "Eliminar columna",
        toggleHeaderRow: "Alternar fila de encabezado",
        deleteTable: "Eliminar tabla",
        linkTooltip: "Insertar o editar enlace",
        linkDisplayNameLabel: "Nombre a mostrar",
        linkDisplayNamePlaceholder: "Texto del enlace",
        linkUrlLabel: "Valor del enlace",
        linkPlaceholder: "https://ejemplo.com",
        applyLink: "Aplicar",
        removeLink: "Quitar enlace",
        textColorTooltip: "Color de texto",
        textColorDefault: "Sin color (Predeterminado)",
        noColorLabel: "Sin color",
        customColorTooltip: "Color personalizado",
        alignTooltip: "Alineación",
        alignLeft: "Alinear a la izquierda",
        alignCenter: "Centrar",
        alignRight: "Alinear a la derecha",
        alignJustify: "Justificar",
        clearFormatting: "Limpiar formato",
        placeholder: "Escribe tu nota, lista o pega un bloque de código...",
        contextPanelSection: "Panel",
        contextInsertTable: "Insertar tabla",
        contextAddBlockquote: "Agregar cita en bloque",
        contextAddCodeBlock: "Agregar bloque de código (Monoestilo)",
        contextShowFormattingBar: "Mostrar menú de formato",
        contextTextFormat: "Formato de texto",
        contextBlockStyle: "Estilo de texto",
        contextTextColor: "Color de texto",
        contextHighlightColor: "Resaltado",
        contextAlignment: "Alineación",
        contextLists: "Listas",
        contextTableSection: "Tabla",
        contextSpellingCategory: "Ortografía",
        contextIgnoreWord: "Ignorar",
        contextAddToDictionary: "Agregar al diccionario",
        contextNoSuggestions: "Sin sugerencias",
        contextDisableSpellcheck: "Desactivar ortografía",
        contextEnableSpellcheck: "Activar ortografía",
        contextSpellcheckDisabledNote: "Ortografía desactivada",
        contextCut: "Cortar",
        contextCopy: "Copiar",
        contextCopyFormatted: "Copiar con formato",
        contextCopyMarkdown: "Copiar sin formato (Markdown)",
        contextPaste: "Pegar",
        contextSelectAll: "Seleccionar todo",
        insertImageTooltip: "Insertar imagen",
        contextInsertImage: "Insertar imagen...",
        imageLoading: "Cargando imagen...",
        imageMissing: "Imagen no disponible",
        imageCopyTooltip: "Copiar imagen",
        imageCopiedTooltip: "Imagen copiada",
        imageDuplicateTooltip: "Duplicar imagen",
        imageDeleteTooltip: "Eliminar imagen",
        imageOriginalSize: "Original",
        imageAlignLeft: "Alinear izquierda",
        imageAlignCenter: "Centrar",
        imageAlignRight: "Alinear derecha",
        imageDragToResizeTooltip: "Arrastra los bordes para redimensionar",
        imagePasteErrorTitle: "No se pudo insertar la imagen",
      },
    },
    modals: {
      folderDeleteSingleTitle: (name: string) => `¿Desea eliminar "${name}"?`,
      folderDeleteMultiTitle: "¿Desea eliminar las carpetas seleccionadas?",
      folderDeleteSingleBody: "Todos los elementos de la carpeta se moverán al Basurero.",
      folderDeleteMultiBody: "Todos los elementos de estas carpetas se moverán al Basurero.",
      batchSnippetDeleteTitle: "¿Eliminar snippets seleccionados?",
      batchSnippetDeleteBody:
        "¿Estás seguro de que deseas mover los snippets seleccionados al Basurero?",
      permanentDeleteTitle: "¿Desea eliminar permanentemente?",
      permanentDeleteBody: "Esta acción no se puede deshacer.",
      snippetDeleteTitle: "¿Eliminar snippet?",
      snippetDeleteBodyPrefix: "¿Estás seguro de que deseas eliminar ",
      snippetDeleteBodySuffix: "? Esta acción no se puede deshacer.",
    },
    settings: {
      modalTitle: "Configuración",
      closeTooltip: "Cerrar (Esc)",
      closeAria: "Cerrar configuración",
      optionsHeader: "Opciones",
      pressEscPrefix: "Presiona",
      pressEscSuffix: "para salir",
      sections: {
        appearance: {
          label: "Apariencia",
          description: "Personaliza el tema, colores y tamaño de fuente.",
        },
        editor: {
          label: "Editor de texto",
          description: "Opciones de indentación, ajuste de línea y formato.",
        },
        general: {
          label: "General",
          description: "Comportamiento general, idioma y opciones de inicio.",
        },
        about: {
          label: "Acerca de",
          description: "Versión, licencia y créditos de la aplicación.",
        },
      },
      general: {
        title: "General",
        subtitle: "Idioma de la aplicación y respaldo de datos.",
        languageCategory: "General",
        languageName: "Idioma",
        languageDescription: "Selecciona el idioma de la interfaz.",
        spanishOption: "Español (Predeterminado)",
        englishOption: "English",
        backupCategory: "Sincronización y Copia de Seguridad",
        backupName: "Respaldo y migración",
        backupDescription:
          "Exporta o importa tus notas, carpetas, etiquetas e imágenes.",
        autoSyncBadge: "Auto-respaldo activo",
        autoSyncStats: (snippets: number, folders: number, tags: number) =>
          `${snippets} snippets · ${folders} carpetas · ${tags} etiquetas`,
        lastSyncedLabel: "Última sync:",
        openBackupLocationButton: "Abrir ubicación",
        exportBackupButton: "Exportar (.codestash.zip)",
        exportJsonlBackupButton: "Solo texto (.jsonl)",
        importBackupButton: "Importar datos",
        assetsCountLabel: (count: number) =>
          `${count} ${count === 1 ? "imagen" : "imágenes"}`,
        importConfirmAssetsLabel: (count: number) =>
          `Incluye ${count} ${count === 1 ? "imagen adjunta" : "imágenes adjuntas"}`,
        exportSuccessMessage: (snippets: number, folders: number, tags: number) =>
          `Copia de seguridad exportada correctamente (${snippets} snippets, ${folders} carpetas, ${tags} etiquetas).`,
        importSuccessMessage: (snippets: number, folders: number, tags: number) =>
          `Datos importados y sincronizados correctamente (${snippets} snippets, ${folders} carpetas, ${tags} etiquetas).`,
        importConfirmModalTitle: "¿Confirmar importación de copia de seguridad?",
        importConfirmModalWarning:
          "Antes de importar: esta acción reemplazará tus notas, carpetas y etiquetas actuales con los datos de la copia de seguridad seleccionada. ¿Estás seguro de que deseas continuar?",
        importConfirmFileLabel: "Archivo seleccionado:",
        importConfirmFormatLabel: "Formato detectado:",
        importConfirmSummaryLabel: (snippets: number, folders: number, tags: number) =>
          `${snippets} snippets, ${folders} carpetas y ${tags} etiquetas`,
        importConfirmButton: "Confirmar e Importar",
      },
      appearance: {
        title: "Apariencia",
        subtitle:
          "Configura temas de CodeStash, importa diseños personalizados o ajusta el tamaño de fuente.",
        themeCategory: "Apariencia",
        themeName: "Tema",
        themeDescription:
          "Selecciona un tema integrado o importa uno personalizado en JSON.",
        customThemesGroup: "Temas Personalizados",
        exploreThemeButton: "Explorar Tema",
        exploreThemeTooltip: "Cargar y aplicar un archivo JSON de tema personalizado",
        activePaletteLabel: "Paleta activa:",
        darkMode: "Modo Oscuro",
        lightMode: "Modo Claro",
        fontSizeCategory: "Editor",
        fontSizeName: "Tamaño de fuente",
        fontSizeDescription:
          "Controla el tamaño de fuente en píxeles para el código y el visor.",
        fontSizeNote: "Recomendado: 13 – 16 px.",
        jsonSectionTitle: "Archivo de Configuración Local",
        localConfigThemeTag: "Temas",
        reloadButton: "Recargar",
        reloadTooltip: "Recargar configuración si modificaste el archivo JSON externamente",
        openFolderButton: "Abrir carpeta",
        openFolderTooltip: "Abrir ubicación del archivo en el explorador de archivos",
        jsonDescriptionPrefix: "Edita",
        jsonDescriptionSuffix:
          "en la carpeta de la aplicación para personalizar temas y fuentes.",
        copyPathTooltip: "Copiar ruta del archivo",
        copiedButton: "Copiado",
        copyButton: "Copiar",
        downloadTemplateButton: "Descargar plantilla JSON de tema de ejemplo",
        installedCustomThemesTitle: "Temas Personalizados Instalados",
        activeBadge: "Activo",
        activateButton: "Activar",
        deleteCustomThemeTooltip: "Eliminar tema personalizado",
        livePreviewTitle: "Vista Previa en Tiempo Real",
        livePreviewComment: (name: string, mode: string) =>
          `// Tema activo: ${name} (${mode})`,
        livePreviewReturn: '"¡Disfruta de tu diseño personalizado en CodeStash!"',
        themeImportedSuccess: (name: string) =>
          `Tema "${name}" importado y aplicado correctamente.`,
        configReloadedSuccess:
          "Configuración y temas recargados desde appearance-config.json.",
        configReloadError: "No se pudo recargar el archivo de configuración.",
      },
      editorSection: {
        title: "Editor de texto",
        subtitle: "Comportamiento del editor de código, sangría y visualización.",
        category: "Editor",
        tabSizeName: "Tamaño de tabulación",
        tabSizeDescription:
          "Controla el número de espacios equivalentes a una tabulación.",
        spacesCount: (n: number) => `${n} espacios`,
        lineNumbersName: "Números de línea",
        lineNumbersDescription:
          "Muestra u oculta la columna con números de línea en el editor.",
        enableLineNumbers: "Habilitar números de línea",
        wordWrapName: "Ajuste de línea",
        wordWrapDescription:
          "Controla si las líneas largas de código deben dividirse visualmente.",
        enableWordWrap: "Ajuste automático de línea",
        spellcheckName: "Corrector ortográfico",
        spellcheckDescription:
          "Subraya errores ortográficos en texto plano y muestra sugerencias al hacer clic derecho.",
        enableSpellcheck: "Habilitar corrector ortográfico",
      },
      about: {
        title: "Acerca de CodeStash",
        subtitle: "Información de la aplicación, autoría, licencia y contacto.",
        appDescription:
          "CodeStash es un gestor de notas y snippets de código offline y privado. Cuenta con soporte para múltiples pestañas por entrada, detección inteligente de lenguajes, clasificación por carpetas y etiquetas, y búsqueda global instantánea dentro de una interfaz minimalista.",
        developerLabel: "Desarrollador / Autor",
        licenseLabel: "Licencia de Software",
        copyrightLabel: "Derechos Reservados",
        copyrightValue: "© Todos los derechos reservados.",
        contactHeader: "Contacto y Redes Sociales",
        emailLabel: "Correo",
      },
    },
  },
  en: {
    common: {
      cancel: "Cancel",
      delete: "Delete",
      deleteAll: "Delete all",
      rename: "Rename",
      duplicate: "Duplicate",
      close: "Close",
      defaultBadge: "(Default)",
    },
    titlebar: {
      visitGithub: "Visit CodeStash GitHub repository",
      searchPlaceholder: "Search snippets ...",
      minimize: "Minimize",
      maximize: "Maximize",
      restore: "Restore",
      close: "Close",
      minimizeAria: "Minimize window",
      maximizeAria: "Maximize window",
      closeAria: "Close window",
    },
    sidebar: {
      allSnippets: "All Snippets",
      favorites: "Favorites",
      uncategorized: "Uncategorized",
      trash: "Trash",
      foldersHeader: "Folders",
      createRootFolder: "Create root folder",
      noFolders: "No folders",
      newFolder: "New folder",
      untitledFolder: "Untitled folder",
      tagsHeader: "Tags",
      createTag: "Create tag",
      noTags: "No tags",
      tagRenamePlaceholder: "Tag name...",
      changeColor: "Change color",
      selectColorAria: (color: string) => `Select color ${color}`,
      settings: "Settings",
      settingsTooltip: "Settings (Ctrl+,)",
      settingsAria: "Open settings panel",
      resizeFoldersTooltip: "Drag to resize folders panel",
    },
    tagModal: {
      title: "New Tag",
      nameLabel: "Tag Name",
      namePlaceholder: "e.g. backend, async, auth...",
      nameRequiredError: "Tag name is required",
      createFailedError: "Failed to create tag",
      colorLabel: "Tag Color",
      createButton: "Create Tag",
    },
    snippetList: {
      searchTitle: (query: string) => `Search: "${query}"`,
      tagFallback: "Tag",
      folderFallback: "Folder",
      foldersTitle: "Folders",
      snippetsTitle: "Snippets",
      newSnippetTooltip: "New snippet (Ctrl+N)",
      newSnippetAria: "New snippet",
      trashEmptyTitle: "Trash is empty",
      trashEmptySubtitle: "Items you delete will appear here.",
      noSnippetsTitle: "No snippets found",
      noSnippetsSubtitle: "Create a new snippet or adjust your search filter.",
      createSnippetButton: "Create Snippet",
      restoreToUncategorized: "Restore to Uncategorized",
      deletePermanently: "Delete Permanently",
      untitledSnippet: "Untitled Snippet",
      copySuffix: "(Copy)",
      resizeListTooltip: "Drag to resize snippets list",
    },
    workspace: {
      trashSelectedTitle: "Trash selected",
      trashSelectedSubtitle: "Select a snippet from the list to preview or restore it.",
      noSnippetSelectedTitle: "No snippet selected",
      noSnippetSelectedSubtitle: "Click + to create a new snippet",
    },
    editor: {
      untitledPlaceholder: "Untitled Snippet",
      notesTooltip: "Notes / Description",
      notesHeader: "Notes & Description",
      notesPlaceholder: "Add notes or description for this snippet...",
      addFragmentTooltip: "Add fragment tab",
      tagsTooltip: "Tags",
      tagsHeader: "Tags",
      tagsSelectedCount: (count: number) => `${count} selected`,
      noTagsCreatedYet: "No tags created yet.",
      markFavoriteTooltip: "Mark favorite",
      unmarkFavoriteTooltip: "Unmark favorite",
      toggleFavoriteAria: "Toggle favorite",
      copiedTooltip: "Copied!",
      copyCodeTooltip: "Copy code",
      copyCodeAria: "Copy snippet code",
      copyNoteTooltip: "Copy note",
      copyNoteAria: "Note copy options",
      copyWithFormatting: "Copy with formatting",
      copyWithFormattingHint: "For Word, WhatsApp, Docs...",
      copyWithoutFormatting: "Copy without formatting (Markdown)",
      copyWithoutFormattingHint: "Clean Markdown (Obsidian, etc.)",
      deleteSnippetTooltip: "Delete snippet",
      fragmentTabTooltip: (label: string) =>
        `${label} (Drag horizontally • Double-click to rename)`,
      closeFragmentTooltip: (label: string) => `Close ${label}`,
      addFragmentShortTooltip: "Add fragment",
      searchLanguagePlaceholder: "Search language...",
      autoDetect: "Auto-detect",
      languageSelectorTooltip: "Language selector (Click to override)",
      linesCount: (count: number) => `${count} lines`,
      charsCount: (count: number) => `${count} chars`,
      markdown: {
        previewTooltip: "Preview Markdown",
        codeTooltip: "View Markdown code",
        previewAria: "Toggle Markdown preview",
        copyCodeBlock: "Copy block",
        copiedBlock: "Copied",
        diagramRendering: "Rendering diagram...",
        diagramRenderError: "Could not render diagram",
        diagramSourceToggle: "View source",
        diagramVisualToggle: "View diagram",
        diagramZoomOut: "Zoom out",
        diagramZoomIn: "Zoom in",
        diagramZoomReset: "Reset zoom (100%)",
        copySvg: "Copy SVG",
        emptySvgError: "The SVG block contains no valid graphics.",
      },
      richText: {
        toolbarAriaLabel: "Text formatting tools",
        hideFormattingBarTooltip: "Hide formatting menu",
        showFormattingBarTooltip: "Show formatting menu",
        showFormattingBarLabel: "Format",
        textStyleTooltip: "Block style & hierarchy",
        blocksCategory: "Hierarchy",
        specialBlocksCategory: "Blocks",
        listsCategory: "List formats",
        listsMenuTooltip: "Lists & checklist",
        shortTitle: "Title",
        shortHeading: "Heading",
        shortSubtitle: "Subhead",
        shortBody: "Body",
        shortQuote: "Quote",
        bold: "Bold",
        italic: "Italic",
        underline: "Underline",
        strikethrough: "Strikethrough",
        highlight: "Highlight text",
        highlightColor: "Highlight color",
        highlightClear: "Remove highlight",
        title: "Title",
        heading: "Heading",
        subtitle: "Subheading",
        body: "Body",
        monospace: "Monostyled",
        bulletList: "Bulleted List",
        dashList: "Dashed List",
        orderedList: "Numbered List",
        blockquote: "Block Quote",
        checklistTooltip: "Checklist",
        tableTooltip: "Table",
        insertTable: "Insert table",
        tableSizeLabel: (rows: number, cols: number) => `${rows} × ${cols} Table`,
        tableRowsSection: "Rows",
        addRowBefore: "Add row above",
        addRowAfter: "Add row below",
        deleteRow: "Delete row",
        tableColsSection: "Columns",
        addColumnBefore: "Add column left",
        addColumnAfter: "Add column right",
        deleteColumn: "Delete column",
        toggleHeaderRow: "Toggle header row",
        deleteTable: "Delete table",
        linkTooltip: "Insert or edit link",
        linkDisplayNameLabel: "Display name",
        linkDisplayNamePlaceholder: "Link text",
        linkUrlLabel: "Link URL",
        linkPlaceholder: "https://example.com",
        applyLink: "Apply",
        removeLink: "Remove link",
        textColorTooltip: "Text color",
        textColorDefault: "No color (Default)",
        noColorLabel: "No color",
        customColorTooltip: "Custom color",
        alignTooltip: "Alignment",
        alignLeft: "Align left",
        alignCenter: "Align center",
        alignRight: "Align right",
        alignJustify: "Justify",
        clearFormatting: "Clear formatting",
        placeholder: "Write your note, list, or paste a code snippet...",
        contextPanelSection: "Panel",
        contextInsertTable: "Insert table",
        contextAddBlockquote: "Add block quote",
        contextAddCodeBlock: "Add code block (Monostyled)",
        contextShowFormattingBar: "Show formatting menu",
        contextTextFormat: "Text formatting",
        contextBlockStyle: "Text style",
        contextTextColor: "Text color",
        contextHighlightColor: "Highlight",
        contextAlignment: "Alignment",
        contextLists: "Lists",
        contextTableSection: "Table",
        contextSpellingCategory: "Spelling",
        contextIgnoreWord: "Ignore",
        contextAddToDictionary: "Add to dictionary",
        contextNoSuggestions: "No suggestions",
        contextDisableSpellcheck: "Disable spell check",
        contextEnableSpellcheck: "Enable spell check",
        contextSpellcheckDisabledNote: "Spell check disabled",
        contextCut: "Cut",
        contextCopy: "Copy",
        contextCopyFormatted: "Copy with formatting",
        contextCopyMarkdown: "Copy without formatting (Markdown)",
        contextPaste: "Paste",
        contextSelectAll: "Select all",
        insertImageTooltip: "Insert image",
        contextInsertImage: "Insert image...",
        imageLoading: "Loading image...",
        imageMissing: "Image unavailable",
        imageCopyTooltip: "Copy image",
        imageCopiedTooltip: "Image copied",
        imageDuplicateTooltip: "Duplicate image",
        imageDeleteTooltip: "Delete image",
        imageOriginalSize: "Original",
        imageAlignLeft: "Align left",
        imageAlignCenter: "Center",
        imageAlignRight: "Align right",
        imageDragToResizeTooltip: "Drag edges to resize",
        imagePasteErrorTitle: "Could not insert image",
      },
    },
    modals: {
      folderDeleteSingleTitle: (name: string) => `Delete "${name}"?`,
      folderDeleteMultiTitle: "Delete selected folders?",
      folderDeleteSingleBody: "All items in this folder will be moved to Trash.",
      folderDeleteMultiBody: "All items in these folders will be moved to Trash.",
      batchSnippetDeleteTitle: "Delete selected snippets?",
      batchSnippetDeleteBody:
        "Are you sure you want to move the selected snippets to Trash?",
      permanentDeleteTitle: "Delete permanently?",
      permanentDeleteBody: "This action cannot be undone.",
      snippetDeleteTitle: "Delete Snippet?",
      snippetDeleteBodyPrefix: "Are you sure you want to delete ",
      snippetDeleteBodySuffix: "? This action cannot be undone.",
    },
    settings: {
      modalTitle: "Settings",
      closeTooltip: "Close (Esc)",
      closeAria: "Close settings",
      optionsHeader: "Options",
      pressEscPrefix: "Press",
      pressEscSuffix: "to exit",
      sections: {
        appearance: {
          label: "Appearance",
          description: "Customize theme, colors, and font size.",
        },
        editor: {
          label: "Text Editor",
          description: "Indentation, word wrap, and formatting options.",
        },
        general: {
          label: "General",
          description: "General behavior, language, and startup options.",
        },
        about: {
          label: "About",
          description: "Application version, license, and credits.",
        },
      },
      general: {
        title: "General",
        subtitle: "Interface language and data backup.",
        languageCategory: "General",
        languageName: "Language",
        languageDescription: "Select the interface display language.",
        spanishOption: "Español (Default)",
        englishOption: "English",
        backupCategory: "Synchronization & Backup",
        backupName: "Backup & migration",
        backupDescription:
          "Export or import your notes, folders, tags, and images.",
        autoSyncBadge: "Auto-backup active",
        autoSyncStats: (snippets: number, folders: number, tags: number) =>
          `${snippets} snippets · ${folders} folders · ${tags} tags`,
        lastSyncedLabel: "Last sync:",
        openBackupLocationButton: "Open location",
        exportBackupButton: "Export (.codestash.zip)",
        exportJsonlBackupButton: "Text only (.jsonl)",
        importBackupButton: "Import data",
        assetsCountLabel: (count: number) =>
          `${count} ${count === 1 ? "image" : "images"}`,
        importConfirmAssetsLabel: (count: number) =>
          `Includes ${count} ${count === 1 ? "attached image" : "attached images"}`,
        exportSuccessMessage: (snippets: number, folders: number, tags: number) =>
          `Backup exported successfully (${snippets} snippets, ${folders} folders, ${tags} tags).`,
        importSuccessMessage: (snippets: number, folders: number, tags: number) =>
          `Data imported and synchronized successfully (${snippets} snippets, ${folders} folders, ${tags} tags).`,
        importConfirmModalTitle: "Confirm Backup Import?",
        importConfirmModalWarning:
          "Before importing: this action will replace your current notes, folders, and tags with the data from the selected backup file. Are you sure you want to continue?",
        importConfirmFileLabel: "Selected file:",
        importConfirmFormatLabel: "Detected format:",
        importConfirmSummaryLabel: (snippets: number, folders: number, tags: number) =>
          `${snippets} snippets, ${folders} folders, and ${tags} tags`,
        importConfirmButton: "Confirm & Import",
      },
      appearance: {
        title: "Appearance",
        subtitle:
          "Choose CodeStash themes, import custom JSON designs, or adjust font size.",
        themeCategory: "Appearance",
        themeName: "Theme",
        themeDescription: "Select a built-in theme or import a custom JSON theme.",
        customThemesGroup: "Custom Themes",
        exploreThemeButton: "Browse Theme",
        exploreThemeTooltip: "Load and apply a custom JSON theme file",
        activePaletteLabel: "Active palette:",
        darkMode: "Dark Mode",
        lightMode: "Light Mode",
        fontSizeCategory: "Editor",
        fontSizeName: "Font Size",
        fontSizeDescription: "Controls the font size in pixels for the code editor.",
        fontSizeNote: "Recommended: 13 – 16 px.",
        jsonSectionTitle: "Local Configuration File",
        localConfigThemeTag: "Themes",
        reloadButton: "Reload",
        reloadTooltip: "Reload configuration if you modified the JSON file externally",
        openFolderButton: "Open folder",
        openFolderTooltip: "Open file location in file explorer",
        jsonDescriptionPrefix: "Edit",
        jsonDescriptionSuffix: "in the app folder to customize themes and fonts.",
        copyPathTooltip: "Copy file path",
        copiedButton: "Copied",
        copyButton: "Copy",
        downloadTemplateButton: "Download sample theme JSON template",
        installedCustomThemesTitle: "Installed Custom Themes",
        activeBadge: "Active",
        activateButton: "Activate",
        deleteCustomThemeTooltip: "Delete custom theme",
        livePreviewTitle: "Live Preview",
        livePreviewComment: (name: string, mode: string) =>
          `// Active theme: ${name} (${mode})`,
        livePreviewReturn: '"Enjoy your customized design in CodeStash!"',
        themeImportedSuccess: (name: string) =>
          `Theme "${name}" imported and applied successfully.`,
        configReloadedSuccess:
          "Configuration and themes reloaded from appearance-config.json.",
        configReloadError: "Could not reload the configuration file.",
      },
      editorSection: {
        title: "Text Editor",
        subtitle: "Code editor behavior, indentation, and display options.",
        category: "Editor",
        tabSizeName: "Tab Size",
        tabSizeDescription: "Controls the number of spaces equivalent to a tab.",
        spacesCount: (n: number) => `${n} spaces`,
        lineNumbersName: "Line Numbers",
        lineNumbersDescription: "Shows or hides the line numbers gutter in the editor.",
        enableLineNumbers: "Enable line numbers",
        wordWrapName: "Word Wrap",
        wordWrapDescription: "Controls whether long lines of code should wrap visually.",
        enableWordWrap: "Enable word wrap",
        spellcheckName: "Spell Check",
        spellcheckDescription:
          "Underlines misspelled words in plain text notes and shows right-click suggestions.",
        enableSpellcheck: "Enable spell check",
      },
      about: {
        title: "About CodeStash",
        subtitle: "Application information, authorship, license, and contact.",
        appDescription:
          "CodeStash is a fast, distraction-free, offline code snippet and note manager. It features multi-tab fragments per entry, intelligent language detection, folder and tag organization, and instant global search within a minimalist interface.",
        developerLabel: "Developer / Author",
        licenseLabel: "Software License",
        copyrightLabel: "All Rights Reserved",
        copyrightValue: "© 2026 Jorge Pingo Requena. All rights reserved.",
        contactHeader: "Contact & Social Links",
        emailLabel: "Email",
      },
    },
  },
};

export function getTranslations(lang?: AppLanguage): TranslationDictionary {
  return TRANSLATIONS[lang === "en" ? "en" : "es"];
}
