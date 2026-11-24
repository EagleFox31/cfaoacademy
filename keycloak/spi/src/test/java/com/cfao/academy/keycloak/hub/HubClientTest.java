package com.cfao.academy.keycloak.hub;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

class HubClientTest {

    static HubMail mail() {
        return HubMailTest.reset(Locale.FRENCH, 5);
    }

    @Test
    void postsTheBodyWithTheServiceKey() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicReference<String> key = new AtomicReference<>();
        AtomicReference<String> body = new AtomicReference<>();
        server.createContext(HubClient.ENQUEUE_PATH, exchange -> {
            key.set(exchange.getRequestHeaders().getFirst(HubClient.KEY_HEADER));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.sendResponseHeaders(201, -1);
            exchange.close();
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort() + "/";
            HubClient client = new HubClient(base, "k-identity", Duration.ofSeconds(2), Duration.ofSeconds(5));
            assertEquals(201, client.enqueue(mail()).get(10, TimeUnit.SECONDS));
            assertEquals("k-identity", key.get());
            assertTrue(body.get().contains("\"kind\":\"identity.password_reset\""), body.get());
            assertTrue(body.get().contains("SECRETTOKEN42"));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void anUnreachableHubNeverThrowsTowardsTheFlow() throws Exception {
        int port;
        try (ServerSocket free = new ServerSocket(0)) {
            port = free.getLocalPort();
        }
        HubClient client = new HubClient("http://127.0.0.1:" + port, "k", Duration.ofSeconds(2), Duration.ofSeconds(5));
        assertEquals(-1, client.enqueue(mail()).get(10, TimeUnit.SECONDS));
    }

    @Test
    void aRefusalIsReportedByStatus() throws IOException, Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(HubClient.ENQUEUE_PATH, exchange -> {
            exchange.sendResponseHeaders(403, -1);
            exchange.close();
        });
        server.start();
        try {
            HubClient client = new HubClient("http://127.0.0.1:" + server.getAddress().getPort(), "bad",
                    Duration.ofSeconds(2), Duration.ofSeconds(5));
            assertEquals(403, client.enqueue(mail()).get(10, TimeUnit.SECONDS));
        } finally {
            server.stop(0);
        }
    }
}
