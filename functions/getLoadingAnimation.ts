import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        // Return a clean handshake animation without any background
        // This is a simplified version of a handshake animation with transparent background
        const animationData = {
            "v": "5.7.4",
            "fr": 30,
            "ip": 0,
            "op": 90,
            "w": 500,
            "h": 500,
            "nm": "Handshake Loading",
            "ddd": 0,
            "assets": [],
            "layers": [
                {
                    "ddd": 0,
                    "ind": 1,
                    "ty": 4,
                    "nm": "Hand 1",
                    "sr": 1,
                    "ks": {
                        "o": { "a": 0, "k": 100 },
                        "r": {
                            "a": 1,
                            "k": [
                                { "i": { "x": [0.42], "y": [1] }, "o": { "x": [0.58], "y": [0] }, "t": 0, "s": [-10] },
                                { "i": { "x": [0.42], "y": [1] }, "o": { "x": [0.58], "y": [0] }, "t": 45, "s": [10] },
                                { "t": 90, "s": [-10] }
                            ]
                        },
                        "p": { "a": 0, "k": [200, 250, 0] },
                        "a": { "a": 0, "k": [0, 0, 0] },
                        "s": { "a": 0, "k": [100, 100, 100] }
                    },
                    "ao": 0,
                    "shapes": [
                        {
                            "ty": "gr",
                            "it": [
                                {
                                    "ty": "rc",
                                    "d": 1,
                                    "s": { "a": 0, "k": [60, 80] },
                                    "p": { "a": 0, "k": [0, 0] },
                                    "r": { "a": 0, "k": 10 }
                                },
                                {
                                    "ty": "fl",
                                    "c": { "a": 0, "k": [0.89, 0.77, 0.4, 1] },
                                    "o": { "a": 0, "k": 100 }
                                },
                                {
                                    "ty": "tr",
                                    "p": { "a": 0, "k": [0, 0] },
                                    "a": { "a": 0, "k": [0, 0] },
                                    "s": { "a": 0, "k": [100, 100] },
                                    "r": { "a": 0, "k": 0 },
                                    "o": { "a": 0, "k": 100 }
                                }
                            ],
                            "nm": "Palm",
                            "np": 2,
                            "cix": 2,
                            "bm": 0
                        }
                    ],
                    "ip": 0,
                    "op": 90,
                    "st": 0,
                    "bm": 0
                },
                {
                    "ddd": 0,
                    "ind": 2,
                    "ty": 4,
                    "nm": "Hand 2",
                    "sr": 1,
                    "ks": {
                        "o": { "a": 0, "k": 100 },
                        "r": {
                            "a": 1,
                            "k": [
                                { "i": { "x": [0.42], "y": [1] }, "o": { "x": [0.58], "y": [0] }, "t": 0, "s": [10] },
                                { "i": { "x": [0.42], "y": [1] }, "o": { "x": [0.58], "y": [0] }, "t": 45, "s": [-10] },
                                { "t": 90, "s": [10] }
                            ]
                        },
                        "p": { "a": 0, "k": [300, 250, 0] },
                        "a": { "a": 0, "k": [0, 0, 0] },
                        "s": { "a": 0, "k": [100, 100, 100] }
                    },
                    "ao": 0,
                    "shapes": [
                        {
                            "ty": "gr",
                            "it": [
                                {
                                    "ty": "rc",
                                    "d": 1,
                                    "s": { "a": 0, "k": [60, 80] },
                                    "p": { "a": 0, "k": [0, 0] },
                                    "r": { "a": 0, "k": 10 }
                                },
                                {
                                    "ty": "fl",
                                    "c": { "a": 0, "k": [0.89, 0.77, 0.4, 1] },
                                    "o": { "a": 0, "k": 100 }
                                },
                                {
                                    "ty": "tr",
                                    "p": { "a": 0, "k": [0, 0] },
                                    "a": { "a": 0, "k": [0, 0] },
                                    "s": { "a": 0, "k": [100, 100] },
                                    "r": { "a": 0, "k": 0 },
                                    "o": { "a": 0, "k": 100 }
                                }
                            ],
                            "nm": "Palm",
                            "np": 2,
                            "cix": 2,
                            "bm": 0
                        }
                    ],
                    "ip": 0,
                    "op": 90,
                    "st": 0,
                    "bm": 0
                }
            ],
            "markers": []
        };
        
        return Response.json(animationData);
    } catch (error) {
        console.error("Error in getLoadingAnimation:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});