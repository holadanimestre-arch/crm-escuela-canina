<?php
/**
 * Plugin Name: Escuela Canina — Lead Intake
 * Description: Envía cada submit de formulario Divi al CRM (Supabase Edge Function lead-intake).
 * Version:     1.0.0
 * Author:      Escuela Canina
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('EC_LEAD_INTAKE_URL') || !defined('EC_LEAD_INTAKE_SECRET')) {
    add_action('admin_notices', function () {
        echo '<div class="notice notice-error"><p><strong>EC Lead Intake:</strong> faltan EC_LEAD_INTAKE_URL o EC_LEAD_INTAKE_SECRET en wp-config.php.</p></div>';
    });
    return;
}

add_action('et_pb_contact_form_submit', 'ec_lead_intake_handle_submit', 10, 3);

function ec_lead_intake_handle_submit($contact_form_info, $contact_form_number_class, $contact_form_id) {
    $form_number = preg_replace('/[^0-9]/', '', (string) $contact_form_number_class);

    $fields = [];
    foreach ($_POST as $key => $value) {
        if (preg_match('/^et_pb_contact_(.+?)_' . preg_quote($form_number, '/') . '$/', $key, $matches)) {
            $field_id = strtolower($matches[1]);
            $fields[$field_id] = is_string($value) ? sanitize_text_field(wp_unslash($value)) : '';
        }
    }

    $name = ec_lead_intake_pick($fields, ['nombre', 'name', 'nombrecompleto', 'fullname']);
    $email = ec_lead_intake_pick($fields, ['email', 'correo', 'correoelectronico', 'mail']);
    $phone = ec_lead_intake_pick($fields, ['telefono', 'teléfono', 'phone', 'movil', 'móvil']);

    $referrer = wp_get_referer();
    if (!$referrer && !empty($_SERVER['REQUEST_URI'])) {
        $referrer = home_url($_SERVER['REQUEST_URI']);
    }

    $path = $referrer ? wp_parse_url($referrer, PHP_URL_PATH) : '';
    $segments = array_values(array_filter(explode('/', (string) $path)));
    $city_slug = $segments ? strtolower($segments[0]) : '';

    if (!$name || (!$email && !$phone)) {
        error_log(sprintf(
            '[ec-lead-intake] payload incompleto: city_slug=%s name=%s email=%s phone=%s',
            $city_slug, $name, $email, $phone
        ));
        return;
    }

    $body = wp_json_encode([
        'name'       => $name,
        'email'      => $email,
        'phone'      => $phone,
        'city_slug'  => $city_slug,
        'source_url' => $referrer,
    ]);

    $response = wp_remote_post(EC_LEAD_INTAKE_URL, [
        'method'  => 'POST',
        'timeout' => 8,
        'headers' => [
            'Content-Type' => 'application/json',
            'x-api-key'    => EC_LEAD_INTAKE_SECRET,
        ],
        'body'    => $body,
    ]);

    if (is_wp_error($response)) {
        error_log('[ec-lead-intake] error de red: ' . $response->get_error_message());
        return;
    }

    $code = wp_remote_retrieve_response_code($response);
    if ($code < 200 || $code >= 300) {
        error_log(sprintf(
            '[ec-lead-intake] respuesta %d: %s',
            $code,
            wp_remote_retrieve_body($response)
        ));
    }
}

function ec_lead_intake_pick(array $fields, array $keys): string {
    foreach ($keys as $key) {
        $key = strtolower($key);
        if (!empty($fields[$key])) {
            return $fields[$key];
        }
    }
    return '';
}
