<?php
return [
  'app_name' => 'NEXA Business AI',
  'app_url' => getenv('APP_URL') ?: 'http://localhost:8080',
  'data_path' => __DIR__ . '/storage/data.json',
  'timezone' => getenv('APP_TIMEZONE') ?: 'Asia/Jakarta',
  'openai_api_key' => getenv('OPENAI_API_KEY') ?: '',
  'openai_model' => getenv('OPENAI_MODEL') ?: 'gpt-5-mini',
  'from_email' => getenv('MAIL_FROM') ?: 'noreply@example.com',
  'admin_email' => getenv('ADMIN_EMAIL') ?: 'admin@example.com',
  'admin_password' => getenv('ADMIN_PASSWORD') ?: 'ChangeMe123!',
  'demo_mode' => (getenv('DEMO_MODE') ?? 'true') !== 'false',
];
