def create_llm_provider(settings):
    from .deepseek import DeepSeekProvider
    return DeepSeekProvider(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        model=settings.DEEPSEEK_MODEL,
    )


def create_tts_provider(settings):
    from .edgetts import EdgeTTSProvider
    return EdgeTTSProvider()


def create_image_provider(settings):
    from .cogview import CogViewProvider
    return CogViewProvider(
        api_key=settings.GLM_API_KEY,
        model=settings.GLM_IMAGE_MODEL,
    )
