<?php
function e($v): string { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
function flash(string $type,string $message): void { $_SESSION['flash'][]=[$type,$message]; }
function pull_flashes():array{$x=$_SESSION['flash']??[];unset($_SESSION['flash']);return $x;}
function csrf():string{return $_SESSION['csrf']??'';}
function verify_csrf():void{if(!hash_equals(csrf(),$_POST['csrf']??'')){http_response_code(419);exit('CSRF validation failed');}}
function postv(string $key,string $default=''):string{return trim((string)($_POST[$key]??$default));}
function audit(string $action,string $entity,?int $id=null,$details=null):void{db_insert('audit_logs',['actor'=>$_SESSION['email']??'system','action'=>$action,'entity_type'=>$entity,'entity_id'=>$id,'details'=>$details===null?null:json_encode($details,JSON_UNESCAPED_UNICODE)]);}
function money($n):string{return 'Rp '.number_format((float)$n,0,',','.');}
function redirect(string $url):never{header('Location: '.$url);exit;}
function hidden_csrf():string{return '<input type="hidden" name="csrf" value="'.e(csrf()).'">';}
function next_doc_number(string $type):string{$prefix=strtoupper(substr(preg_replace('/[^A-Z]/','',$type),0,3));$n=db_count('documents',fn($r)=>($r['doc_type']??'')===$type)+1;return $prefix.'-'.date('Ym').'-'.str_pad((string)$n,4,'0',STR_PAD_LEFT);}
function find_company_name($id):string{$r=db_find('companies',(int)$id);return $r['name']??'—';}
function find_contact($id):?array{return db_find('contacts',(int)$id);}
function find_lead_joined(int $id):?array{$l=db_find('leads',$id);if(!$l)return null;$c=db_find('companies',(int)$l['company_id']);$ct=find_contact((int)($l['contact_id']??0));return $l+['company_name'=>$c['name']??'','industry'=>$c['industry']??'','contact_name'=>$ct['name']??'','title'=>$ct['title']??'','email'=>$ct['email']??'','consent_status'=>$ct['consent_status']??'unknown'];}
