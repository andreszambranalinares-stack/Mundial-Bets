# Prompt de Funcionalidades — Liga Fantasy Mundial

Necesito que añadas las siguientes funcionalidades nuevas a la aplicación manteniendo toda la estructura, estilos y componentes existentes. Analiza primero el código actual antes de implementar cualquier cambio.

---

## FUNCIONALIDAD 1 — GESTIÓN DE LIGA

El botón para abandonar la liga debe ser un icono de tres puntos verticales situado justo al lado del nombre de la liga. Al pulsar los tres puntos debe desplegarse un pequeño menú con la opción "Abandonar liga". Al pulsar esa opción debe aparecer un modal de confirmación con el mensaje "¿Seguro que quieres abandonar la liga?" y dos botones, uno de Sí y otro de No. Si pulsa Sí ejecuta la acción y saca al usuario de la liga. Si pulsa No cierra el modal sin hacer nada. El creador de la liga verá en ese mismo menú de tres puntos la opción adicional de "Eliminar liga" con su propio modal de confirmación con el mismo formato de Sí y No.

---

## FUNCIONALIDAD 2 — APUESTAS DE ESTADÍSTICAS AVANZADAS POR PARTIDO

Dentro de la vista de detalle de un partido, además de las apuestas normales ya existentes, añadir una sección nueva con botones de categorías de apuestas de estadísticas avanzadas, similar a como funciona Bet365. Al entrar en un partido deben aparecer botones de categoría como Goles, Tarjetas, Jugadores, Tiros a puerta, Córners y Porteros. Al pulsar cada botón se despliega el contenido de esa categoría con sus opciones de apuesta.

La categoría Goles debe mostrar opciones como más de 0.5, más de 1.5, más de 2.5, más de 3.5, primer equipo en marcar, último en marcar, y ambos equipos marcan sí o no.

La categoría Tarjetas debe mostrar opciones como más de 1.5 tarjetas, más de 2.5, más de 3.5, más de 4.5, y si un jugador concreto recibirá amarilla o roja con un buscador de jugador.

La categoría Jugadores debe incluir buscador por nombre y permitir apostar sobre si marcará gol, si dará asistencia, si recibirá tarjeta, y cuántos minutos jugará con rangos 0 a 45, 46 a 90, o no juega.

La categoría Tiros a puerta debe mostrar opciones como más de 2.5, más de 3.5, más de 5.5 tiros totales, y si un jugador concreto disparará a puerta.

La categoría Córners debe mostrar opciones como más de 5.5, más de 7.5, más de 9.5 córners en el partido.

La categoría Porteros debe mostrar opciones como portería a cero del equipo local, portería a cero del equipo visitante, y cuántas paradas hará un portero concreto con rangos 1 a 3, 4 a 6, más de 6.

Los botones de categoría deben estar en una barra horizontal con scroll si no caben todos en pantalla. El botón de la categoría activa debe estar visualmente resaltado. Todo esto debe integrarse dentro de la vista de detalle del partido sin romper las apuestas existentes.

---

## FUNCIONALIDAD 3 — VENTANA DE PERFIL PERSONALIZABLE

La ventana de perfil debe estar accesible desde la barra de navegación inferior donde están el resto de funcionalidades, colocando un botón llamado Perfil en el extremo derecho de esa barra. Al pulsar Perfil se abre una pantalla nueva de perfil. En la parte superior de esa pantalla debe aparecer la foto de perfil actual del usuario, que si no tiene ninguna asignada mostrará un avatar genérico o icono por defecto. Justo debajo de la imagen debe haber un botón o texto que ponga Añadir imagen o Cambiar imagen según si ya tiene una o no. Al pulsar ese botón se abre el selector de archivos del dispositivo para elegir una imagen de la galería. Una vez seleccionada la imagen debe mostrarse como preview antes de guardar y el usuario debe confirmar con un botón Guardar. Debajo de la foto debe aparecer el apodo actual del usuario en un campo de texto editable. El usuario puede modificar el apodo directamente en ese campo y guardar el cambio con un botón Guardar cambios. La pantalla debe seguir el mismo estilo visual y colores que el resto de la aplicación.

---

## FUNCIONALIDAD 4 — ESTADOS Y FILTROS EN MIS APUESTAS

En la vista de apuestas del usuario implementar los siguientes estados: Pendiente para partidos que no han empezado, En directo para partidos en curso con un punto rojo palpitante animado junto al estado, Cerrada ganada, Cerrada perdida, y Cerrada por el usuario cuando él mismo la cierra manualmente. Añadir en la parte superior botones de filtro: Todas, Pendientes, En directo, Cerradas. El botón En directo también debe mostrar el punto rojo palpitante.

---

## FUNCIONALIDAD 5 — TARJETA DE APUESTA SIN ETIQUETAS 1X2

En las tarjetas donde se muestra el resultado de la apuesta eliminar completamente las etiquetas numéricas 1, X y 2. Mostrar únicamente el nombre de la selección apostada, por ejemplo España o Brasil. Si se apostó empate mostrar solo la palabra Empate.

---

## FUNCIONALIDAD 6 — ICONO DE OJO EN CAMPOS DE CONTRASEÑA

En la pantalla de inicio de sesión y en la pantalla de registro añadir un icono de ojo en el extremo derecho de todos los campos de contraseña. Al pulsar el icono el texto de la contraseña alterna entre oculto con puntos y visible en texto plano. El icono debe cambiar visualmente entre ojo abierto y ojo tachado según el estado actual. Esto debe aplicarse también a los campos de contraseña de la pantalla de perfil mencionada en la Funcionalidad 3.

---

## FUNCIONALIDAD 7 — FOTO DE PERFIL VISIBLE EN EL RANKING

En la pantalla de ranking donde aparece la lista de usuarios con su posición y puntos, mostrar la foto de perfil de cada usuario justo a la izquierda de su nombre. Si el usuario no tiene foto asignada mostrar el avatar genérico por defecto. La imagen debe mostrarse en formato circular y de tamaño pequeño acorde al diseño del ranking existente.

---

## FUNCIONALIDAD 8 — IMAGEN DE LIGA

Al crear una liga nueva añadir la opción de subir una imagen o foto para representar esa liga, de forma similar a como se sube la foto de perfil de usuario. Al pulsar el área de imagen debe abrirse el selector de archivos del dispositivo para elegir una imagen de la galería. Si no se sube ninguna imagen la liga mostrará un icono o avatar genérico por defecto. La imagen de la liga debe mostrarse en todos los lugares donde aparece el nombre de la liga, como en la lista de ligas, en la cabecera de la liga y en el menú de tres puntos. El creador de la liga también debe poder cambiar la imagen de la liga en cualquier momento desde el menú de tres puntos de esa misma liga con la opción Editar imagen de liga.

---

## FUNCIONALIDAD 9 — LOGO DE LA APLICACIÓN

Te voy a pasar una imagen que es el logo oficial de la aplicación. Debes implementarlo en todos los lugares visibles donde el usuario interactúa con la app. Esto incluye la pantalla de inicio o splash screen si existe, la pantalla de inicio de sesión, la pantalla de registro, la cabecera o header principal de la aplicación, y cualquier otro lugar donde tenga sentido mostrar la identidad visual de la app como por ejemplo la pantalla de bienvenida o pantalla de carga. El logo debe mostrarse con un tamaño adecuado a cada pantalla, centrado y respetando proporciones sin distorsionarlo. No sustituyas ningún texto funcional por el logo, úsalo como elemento visual de marca junto al nombre de la app donde corresponda.

---

## FUNCIONALIDAD 10 — CHAT DE LIGA

Dentro de la vista de liga, en la misma zona donde aparece el ranking y demás secciones, añadir una pestaña o sección llamada Chat donde todos los miembros de esa liga puedan comunicarse entre sí en tiempo real. El chat debe funcionar como un grupo cerrado por liga, de forma que cada liga tiene su propio chat independiente y solo pueden participar los miembros que pertenecen a esa liga. Cada mensaje debe mostrar la foto de perfil del usuario que lo envía en formato circular a la izquierda, su nombre o apodo, el texto del mensaje y la hora de envío. Los mensajes propios del usuario deben aparecer alineados a la derecha y los del resto a la izquierda, siguiendo el estilo habitual de cualquier chat. En la parte inferior debe haber un campo de texto para escribir el mensaje y un botón de enviar. Junto al campo de texto debe haber un botón para abrir el selector de GIFs, que debe integrarse con la API de Giphy o Tenor para buscar y enviar GIFs animados directamente en el chat. Al pulsar el botón de GIF debe abrirse un buscador con campo de búsqueda y una cuadrícula de resultados de GIFs para seleccionar. El GIF seleccionado debe enviarse como mensaje en el chat y visualizarse correctamente de forma animada. Si alguna parte del chat en tiempo real requiere configuración adicional en el backend como websockets o canal de Supabase Realtime, indícalo claramente antes de implementar y espera confirmación.

---

## FUNCIONALIDAD 11 — VISTA DE ESCRITORIO RESPONSIVE

Actualmente la aplicación está diseñada solo para móvil y cuando se abre desde un ordenador se ve como una columna estrecha centrada o estirada de forma incorrecta. Necesito que implementes un diseño responsive completo para que la app se vea bien tanto en móvil como en escritorio.

En escritorio la navegación inferior que existe en móvil debe transformarse en una barra lateral fija a la izquierda con los mismos iconos y opciones pero en formato vertical. El contenido principal debe ocupar el espacio restante a la derecha de esa barra lateral. Las tarjetas de partidos, apuestas y ranking deben reorganizarse en una cuadrícula de dos o tres columnas según el ancho disponible. Los modales y ventanas emergentes deben centrarse correctamente en pantalla y tener un ancho máximo razonable para que no se estiren demasiado. Las listas largas como el ranking o las apuestas deben aprovechar el espacio horizontal con un layout más amplio. El chat de liga en escritorio debe mostrarse con la lista de miembros a un lado y el chat al otro, similar a Discord o WhatsApp Web. En pantallas intermedias como tablets debe haber un punto de corte que adapte el diseño de forma coherente entre móvil y escritorio. Usa los breakpoints de Tailwind que ya están configurados en el proyecto para implementar todos estos cambios sin tocar los estilos base de móvil.

---

## FUNCIONALIDAD 12 — INVITAR MIEMBROS POR ENLACE DIRECTO

El creador de la liga debe poder generar un enlace único de invitación para esa liga. Este botón de generar enlace debe estar accesible desde el menú de tres puntos de la liga o desde un botón visible dentro de la vista de la liga. Al pulsar debe generarse una URL única del tipo app.com/unirse/CODIGO que identifica esa liga. El creador puede compartir ese enlace directamente por WhatsApp u otras apps usando el sistema de compartir nativo del dispositivo. Cuando un usuario que ya tiene cuenta abre ese enlace debe ver una pantalla que le muestra el nombre e imagen de la liga y un botón para unirse con un solo clic. Si el usuario no tiene cuenta todavía debe redirigirle primero al registro y después unirse automáticamente a la liga al completarlo. El código de invitación debe poder caducar o desactivarse desde el menú de tres puntos con la opción Desactivar enlace de invitación.

---

## FUNCIONALIDAD 13 — HISTORIAL DE LA LIGA POR JORNADAS

Dentro de la vista de liga añadir una pestaña o sección llamada Historial donde se pueda ver cómo ha evolucionado la clasificación de cada miembro semana a semana o jornada a jornada. Debe mostrarse una tabla o gráfico donde cada fila es un usuario y cada columna es una jornada, mostrando los puntos acumulados en cada momento. Debe ser posible ver quién lideraba en cada jornada y cómo han cambiado las posiciones a lo largo del tiempo. Si el proyecto ya tiene un concepto de jornada implementado úsalo, si no créalo como agrupación de partidos por fecha.

---

## FUNCIONALIDAD 14 — MURO DE ACTIVIDAD EN TIEMPO REAL

Dentro de la vista de liga añadir una sección llamada Actividad o un feed visible que muestre en tiempo real las acciones recientes de los miembros de esa liga. Cada entrada del muro debe mostrar la foto de perfil del usuario, su nombre, la acción que realizó y hace cuánto tiempo. Las acciones que deben aparecer son cuando alguien realiza una apuesta mostrando el partido y la selección apostada pero sin revelar los detalles exactos si el partido no ha empezado, cuando alguien acierta o falla una apuesta una vez cerrado el partido, cuando un nuevo miembro se une a la liga, y cuando alguien sube en el ranking. El feed debe actualizarse automáticamente sin necesidad de recargar la página usando Supabase Realtime. Si requiere configuración adicional en base de datos indícalo antes de implementar.

---

## FUNCIONALIDAD 15 — MARCADOR EN DIRECTO DENTRO DEL PARTIDO

Dentro de la vista de detalle de un partido que esté en curso mostrar el marcador actualizado en tiempo real con el resultado actual, el minuto de juego y si hay prórroga o penaltis. El marcador debe ser visible de forma prominente en la parte superior de la vista del partido. Debe actualizarse automáticamente sin recargar la página. Para obtener los datos del marcador en directo integra una API de fútbol gratuita como API-Football en su plan gratuito o Football-Data.org. Indica qué API recomiendas usar y si requiere configuración de clave en el archivo de entorno antes de implementar.

---

## FUNCIONALIDAD 16 — CUENTA ATRÁS EN LA TARJETA DEL PARTIDO

En las tarjetas de partidos que todavía no han empezado mostrar una cuenta atrás en tiempo real que indique cuánto tiempo falta para el inicio del partido. El formato debe mostrar días, horas, minutos y segundos actualizándose cada segundo. Cuando el partido empiece la cuenta atrás debe desaparecer y sustituirse por el marcador en directo o el estado En juego. Cuando falte menos de una hora el contador debe resaltarse visualmente para llamar la atención del usuario.

---

## FUNCIONALIDAD 17 — MODO OSCURO Y MODO CLARO

Añadir un toggle para cambiar entre modo oscuro y modo claro en la aplicación. Este toggle debe estar accesible desde la pantalla de perfil. La preferencia debe guardarse y mantenerse entre sesiones para que el usuario no tenga que cambiarlo cada vez que entra. Por defecto la app debe respetar la preferencia del sistema operativo del dispositivo, es decir si el móvil u ordenador tiene el modo oscuro activado la app debe iniciarse en oscuro automáticamente. Usa las clases de Tailwind para dark mode que ya están disponibles en el proyecto y aplica los colores correspondientes en todos los componentes existentes de forma consistente.

---

## FUNCIONALIDAD 18 — PANTALLA DE ONBOARDING PARA USUARIOS NUEVOS

La primera vez que un usuario entra en la aplicación tras registrarse debe ver una pantalla de bienvenida o tutorial breve que explique cómo funciona la app. Debe consistir en entre tres y cinco pantallas deslizables que expliquen de forma visual y sencilla cómo unirse a una liga, cómo realizar una apuesta, cómo funciona el sistema de puntos y cómo ver el ranking. Cada pantalla debe tener una ilustración o icono representativo, un título corto y una descripción breve. Al final debe haber un botón de Empezar que lleve al usuario a la pantalla principal. Debe haber también una opción de Saltar para quien no quiera verlo. Una vez visto el onboarding no debe volver a mostrarse al mismo usuario en accesos posteriores, guardando ese estado en Supabase o en el almacenamiento local.

---

## INSTRUCCIONES GENERALES

Analiza toda la estructura del proyecto antes de tocar nada. Mantén los estilos, colores, componentes y sistema de estado existentes. Implementa cada funcionalidad de forma modular para no romper lo que ya funciona. Si alguna funcionalidad requiere nuevas tablas o campos en base de datos indícalo claramente antes de implementar y espera confirmación.
1
