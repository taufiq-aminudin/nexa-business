<?php
function ai_chat(string $system,string $user,?array $jsonSchema=null):array{
  global $config;
  if($config['demo_mode']||!$config['openai_api_key'])return ['ok'=>true,'demo'=>true,'text'=>ai_demo($user),'data'=>null];
  $payload=['model'=>$config['openai_model'],'messages'=>[['role'=>'system','content'=>$system],['role'=>'user','content'=>$user]],'temperature'=>0.2];
  if($jsonSchema)$payload['response_format']=['type'=>'json_schema','json_schema'=>$jsonSchema];
  $ch=curl_init('https://api.openai.com/v1/chat/completions');
  curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$config['openai_api_key']],CURLOPT_POSTFIELDS=>json_encode($payload),CURLOPT_TIMEOUT=>60]);
  $res=curl_exec($ch);$err=curl_error($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
  if($err||$code>=400)return ['ok'=>false,'error'=>$err?:'AI API error '.$code];
  $obj=json_decode($res,true);return ['ok'=>true,'demo'=>false,'text'=>$obj['choices'][0]['message']['content']??'','data'=>null];
}
function ai_demo(string $prompt):string{$p=strtolower($prompt);if(str_contains($p,'classify'))return json_encode(['intent'=>'INTERESTED','next_action'=>'Send company profile and ask for requirements.']);if(str_contains($p,'property'))return 'AI demo: property appears suitable for agent outreach; prepare seller approach and marketing draft.';return "AI demo response generated from the configured business mission. Add OPENAI_API_KEY and set DEMO_MODE=false for live AI.";}
function ai_generate_outreach(array $lead):string{
  $prompt="Create a concise professional B2B outreach email. Company: {$lead['company_name']}. Industry: {$lead['industry']}. Contact: {$lead['contact_name']}. Title: {$lead['title']}. Detected signal: {$lead['signal']}. Service: {$lead['business_type']}. Do not invent facts. Include clear CTA.";
  $r=ai_chat('You are a B2B sales assistant. Use only provided facts.',$prompt);return $r['text']??'';
}
