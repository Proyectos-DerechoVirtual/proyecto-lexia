import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

// Gemini API para generar imágenes
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { topic, content, userEmail, userName } = req.body;

    if (!topic || !userEmail) {
      return res.status(400).json({ error: 'Faltan campos requeridos (topic, userEmail)' });
    }

    console.log(`[Schema] Generando esquema para: ${topic} -> ${userEmail}`);

    // 1. Generar la infografía con Gemini 3 Pro Image
    const prompt = `Actúa como un diseñador de infografías educativas y crea un ESQUEMA VISUAL.

TEMA A EXPLICAR:
"${topic}"

${content ? `CONTENIDO ADICIONAL:\n${content.substring(0, 1000)}` : ''}

INSTRUCCIONES DE DISEÑO:
- Formato HORIZONTAL (16:9)
- Estilo de "Apuntes Visuales" o "Esquema de Estudio"
- Fondo con degradado suave (beige/crema profesional)

ESTRUCTURA DEL ESQUEMA:
1. TÍTULO PRINCIPAL: "${topic}" (centrado arriba, tipografía grande y clara)
2. PUNTOS CLAVE: 3-5 conceptos principales en recuadros conectados
3. DEFINICIONES: Explicaciones breves y claras
4. RELACIONES: Flechas y conectores entre conceptos
5. TIPS: Sección "¡Recuerda!" con consejos para memorizar

ESTILO VISUAL:
- Colores: Azul/Verde para conceptos principales, Naranja para advertencias
- Iconos ilustrativos para cada sección
- Texto en ESPAÑOL, claro y legible
- Jerarquía visual clara (títulos > subtítulos > texto)
- Estilo profesional pero amigable
- TODO el texto debe ser COMPLETAMENTE LEGIBLE

IMPORTANTE:
- El esquema debe ser AUTOEXPLICATIVO
- Debe servir como material de repaso rápido
- Incluye ejemplos si son relevantes`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT']
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json().catch(() => ({}));
      console.error('[Schema] Error Gemini:', errorData);
      throw new Error(`Error de Gemini API: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();

    // Buscar la imagen en la respuesta
    const parts = geminiData.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) => part.inlineData);

    if (!imagePart || !imagePart.inlineData) {
      console.error('[Schema] No se encontró imagen en respuesta:', JSON.stringify(geminiData).substring(0, 500));
      throw new Error('No se pudo generar el esquema visual');
    }

    const base64Image = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || 'image/png';

    console.log('[Schema] Imagen generada correctamente');

    // 2. Configurar transporter de email
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 3. Preparar y enviar el email
    const mailOptions = {
      from: `"LexAI - Tu Asistente de Estudio" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: `📊 Tu Esquema: ${topic}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #64c27b; text-align: center;">📚 Esquema de Estudio</h1>
          <h2 style="color: #333; text-align: center;">${topic}</h2>
          <p style="color: #333; font-size: 16px;">
            Hola${userName ? ` ${userName}` : ''},
          </p>
          <p style="color: #333; font-size: 16px;">
            Aquí tienes tu esquema personalizado con los puntos clave sobre <strong>${topic}</strong>.
          </p>
          <p style="color: #333; font-size: 16px;">
            Úsalo para repasar y consolidar lo que has aprendido. ¡Guárdalo o imprímelo!
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            ¡Mucho ánimo con tu preparación! 💪
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Este email fue enviado desde LexAI - Tu Asistente de Estudio
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `esquema-${topic.toLowerCase().replace(/\s+/g, '-').substring(0, 30)}.png`,
          content: base64Image,
          encoding: 'base64',
          cid: 'esquema',
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    console.log(`[Schema] Email enviado a ${userEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Esquema generado y enviado correctamente'
    });

  } catch (error: any) {
    console.error('[Schema] Error:', error);
    return res.status(500).json({
      error: 'Error al generar o enviar el esquema',
      details: error.message
    });
  }
}
