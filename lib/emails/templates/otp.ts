import { EmailTemplate } from "../types"

export const otpTemplate: EmailTemplate = {
  subject: "Seu código de acesso",
  html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu Código de Acesso</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f4f4f5;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background-color: #ffffff;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      text-align: center;
    }
    .logo {
      margin-bottom: 32px;
    }
    .logo img {
      height: 48px;
      width: auto;
    }
    h1 {
      color: #18181b;
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 16px;
      letter-spacing: -0.025em;
    }
    p {
      color: #52525b;
      font-size: 16px;
      line-height: 24px;
      margin: 0 0 24px;
    }
    .code-container {
      background-color: #f4f4f5;
      border-radius: 12px;
      padding: 24px;
      margin: 32px 0;
      border: 1px solid #e4e4e7;
    }
    .code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 32px;
      font-weight: 700;
      color: #18181b;
      letter-spacing: 8px;
      margin: 0;
    }
    .footer {
      margin-top: 32px;
      text-align: center;
    }
    .footer p {
      font-size: 12px;
      color: #a1a1aa;
      margin: 0;
    }
    .divider {
      height: 1px;
      background-color: #e4e4e7;
      margin: 32px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <img src="{{logoUrl}}" alt="SIE Logo" style="max-height: 48px;">
      </div>
      
      <h1>Seu código de acesso</h1>
      
      <p>Use o código abaixo para fazer login na plataforma SIE. Este código é válido por 10 minutos.</p>
      
      <div class="code-container">
        <div class="code">{{code}}</div>
      </div>
      
      <p style="font-size: 14px; color: #71717a;">
        Se você não solicitou este código, pode ignorar este e-mail com segurança.
      </p>
      
      <div class="divider"></div>
      
      <div class="footer">
        <p>© {{year}} SIE - Secretaria de informação e Empreendedorismo</p>
      </div>
    </div>
  </div>
</body>
</html>
  `,
}
