package com.cfao.academy.keycloak.hub;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

import org.jboss.logging.Logger;
import org.keycloak.util.JsonSerialization;

/**
 * Envoi au hub, hors du fil de la requête : la réponse de Keycloak ne dépend ni du hub
 * ni de l'existence du compte (même délai pour une adresse connue ou inconnue).
 * Aucun repli SMTP : un échec est journalisé (statut seul, jamais le lien).
 */
public class HubClient {

    private static final Logger LOG = Logger.getLogger(HubClient.class);
    static final String ENQUEUE_PATH = "/api/v1/mail/messages/enqueue";
    static final String KEY_HEADER = "X-Mail-Service-Key";

    private final URI enqueue;
    private final String serviceKey;
    private final HttpClient http;
    private final Duration requestTimeout;

    public HubClient(String baseUrl, String serviceKey, Duration connectTimeout, Duration requestTimeout) {
        this.enqueue = URI.create(baseUrl.replaceAll("/+$", "") + ENQUEUE_PATH);
        this.serviceKey = serviceKey;
        this.requestTimeout = requestTimeout;
        this.http = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
    }

    HttpRequest request(HubMail mail) throws IOException {
        return HttpRequest.newBuilder(enqueue)
                .timeout(requestTimeout)
                .header("Content-Type", "application/json")
                .header(KEY_HEADER, serviceKey)
                .POST(HttpRequest.BodyPublishers.ofString(JsonSerialization.writeValueAsString(mail.payload())))
                .build();
    }

    public CompletableFuture<Integer> enqueue(HubMail mail) {
        HttpRequest request;
        try {
            request = request(mail);
        } catch (IOException | RuntimeException e) {
            LOG.errorf("cfao-hub : %s non envoyé (%s)", mail, e.getClass().getSimpleName());
            return CompletableFuture.completedFuture(-1);
        }
        return http.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                .handle((response, error) -> {
                    if (error != null) {
                        Throwable cause = error.getCause() != null ? error.getCause() : error;
                        LOG.errorf("cfao-hub : %s non envoyé (%s)", mail, cause.getClass().getSimpleName());
                        return -1;
                    }
                    int status = response.statusCode();
                    if (status == 200 || status == 201) {
                        LOG.debugf("cfao-hub : %s en file (%d)", mail, status);
                    } else {
                        LOG.errorf("cfao-hub : %s refusé par le hub (%d)", mail, status);
                    }
                    return status;
                });
    }
}
